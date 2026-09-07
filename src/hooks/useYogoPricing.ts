import { useQuery } from "@tanstack/react-query";
import { buildPurchaseUrl as buildYogoPurchaseUrl } from "@/lib/yogoLinks";

// --- Types matching YOGO API responses ---

interface YogoPaymentOption {
  id: number;
  name: string;
  payment_amount: number;
  number_of_months_payment_covers: number;
  for_sale: boolean;
}

interface YogoImage {
  id: number;
  filename: string;
  url: string;
}

interface YogoCampaign {
  id: number;
  name: string;
  reduced_price: number;
  number_of_months_at_reduced_price: number;
}

interface YogoMembershipType {
  id: number;
  name: string;
  description: string;
  registration_fee: number;
  has_max_number_of_classes_per_week: boolean;
  max_number_of_classes_per_week: number;
  has_max_number_of_classes_per_month: boolean;
  max_number_of_classes_per_month: number;
  for_sale: number;
  payment_options?: YogoPaymentOption[];
  price_groups?: { id: number; name: string }[];
  sort_in_price_group: number;
  image_id: number | null;
  image?: YogoImage | null;
  active_campaign_id: number | null;
  active_campaign?: YogoCampaign | null;
}

interface YogoClassPassType {
  id: number;
  name: string;
  description: string;
  price: number;
  number_of_classes: number;
  days: number;
  for_sale: number;
  price_groups?: { id: number; name: string }[];
  sort_in_price_group: number;
  image_id: number | null;
  image?: YogoImage | null;
}

interface YogoPriceGroupRaw {
  id: number;
  name: string;
  sort: number;
  show_in_default_price_list: boolean;
  membership_types: YogoMembershipType[];
  class_pass_types: YogoClassPassType[];
  class_series_types: unknown[];
}

// --- Processed types for the UI ---

export interface PaymentOptionItem {
  id: number;
  name: string;
  price: number;
  /** Months this single payment covers. null for class passes, which have no period. */
  months: number | null;
  purchaseUrl: string;
}

export interface CampaignInfo {
  name: string;
  reducedPrice: number;
  months: number;
}

export interface PricingItem {
  id: number;
  type: "membership" | "class_pass";
  name: string;
  description: string;
  imageUrl: string | null;
  paymentOptions: PaymentOptionItem[];
  registrationFee: number;
  classesPerWeek: number | null;
  classesPerMonth: number | null;
  isUnlimited: boolean;
  numberOfClasses: number | null;
  validDays: number | null;
  purchaseUrl: string;
  sortInGroup: number;
  campaign: CampaignInfo | null;
}

export interface PriceGroup {
  id: number;
  name: string;
  sort: number;
  showInDefaultPriceList: boolean;
  items: PricingItem[];
}

// --- Helpers ---

function getApiHeaders(): Record<string, string> {
  return {
    accept: "application/json",
  };
}

/**
 * Yogo writes -1 (and null on class passes) for "no explicit position". Those must
 * sort last rather than leapfrog plans that do have one — otherwise every plan the
 * gym edits jumps to the front of the row.
 */
export function groupSortKey(sort: number | null | undefined): number {
  return sort != null && sort >= 0 ? sort : 999;
}

function buildImageUrl(image: YogoImage | null | undefined): string | null {
  if (!image?.filename) return null;
  return `https://yogo.imgix.net/${image.filename}?w=600&h=400&fit=crop&auto=format`;
}

function buildPurchaseUrl(
  type: "membership" | "class_pass",
  itemId: number,
  paymentOptionId?: number
): string {
  return type === "class_pass"
    ? buildYogoPurchaseUrl("class_pass_type", itemId)
    : buildYogoPurchaseUrl("membership_type", itemId, { paymentOption: paymentOptionId });
}

// --- API fetchers ---

// Dev: Vite proxy forwards /api/yogo → api.yogo.dk with correct origin header.
// Prod: Vercel serverless function at api/yogo/[...path].ts proxies with headers.
const API_BASE = "/api/yogo";

async function fetchPriceGroups(): Promise<YogoPriceGroupRaw[]> {
  const res = await fetch(
    `${API_BASE}/price-groups?populate[]=membership_types&populate[]=class_pass_types&populate[]=class_series_types`,
    { headers: getApiHeaders() }
  );
  if (!res.ok) throw new Error(`YOGO price-groups: ${res.status}`);
  return res.json();
}

async function fetchMembershipTypes(): Promise<YogoMembershipType[]> {
  const res = await fetch(
    `${API_BASE}/membership-types?populate[]=payment_options&populate[]=price_groups&populate[]=image&populate[]=active_campaign`,
    { headers: getApiHeaders() }
  );
  if (!res.ok) throw new Error(`YOGO membership-types: ${res.status}`);
  return res.json();
}

async function fetchClassPassTypes(): Promise<YogoClassPassType[]> {
  const res = await fetch(
    `${API_BASE}/class-pass-types?populate[]=price_groups&populate[]=image`,
    { headers: getApiHeaders() }
  );
  if (!res.ok) throw new Error(`YOGO class-pass-types: ${res.status}`);
  return res.json();
}

// --- Main data merger ---

function buildPriceGroups(
  groups: YogoPriceGroupRaw[],
  memberships: YogoMembershipType[],
  classPasses: YogoClassPassType[]
): PriceGroup[] {
  // Index memberships by id for quick lookup with payment_options
  const membershipMap = new Map<number, YogoMembershipType>();
  for (const m of memberships) {
    membershipMap.set(m.id, m);
  }

  return groups
    .map((group) => {
      const items: PricingItem[] = [];

      // Process membership types in this group
      for (const rawMember of group.membership_types) {
        const fullMember = membershipMap.get(rawMember.id) || rawMember;
        const paymentOptions = (fullMember.payment_options || [])
          .filter((o) => o.for_sale)
          .map((o) => ({
            id: o.id,
            name: o.name,
            price: o.payment_amount,
            months: o.number_of_months_payment_covers || 1,
            purchaseUrl: buildPurchaseUrl("membership", fullMember.id, o.id),
          }))
          // Period order, not price order: the duration selector depends on it, and it
          // makes paymentOptions[0] mean "shortest commitment".
          .sort((a, b) => (a.months ?? 1) - (b.months ?? 1) || a.price - b.price);
        const firstOption = paymentOptions[0];

        if (!firstOption) continue;

        // A plan capped per MONTH is not unlimited either — checking only the weekly
        // flag made "12 passes/month" plans render as "Aulas ilimitadas".
        const isUnlimited =
          !fullMember.has_max_number_of_classes_per_week &&
          !fullMember.has_max_number_of_classes_per_month;

        const campaign: CampaignInfo | null = fullMember.active_campaign
          ? {
              name: fullMember.active_campaign.name,
              reducedPrice: fullMember.active_campaign.reduced_price,
              months: fullMember.active_campaign.number_of_months_at_reduced_price,
            }
          : null;

        items.push({
          id: fullMember.id,
          type: "membership",
          name: fullMember.name,
          description: fullMember.description || "",
          imageUrl: buildImageUrl(fullMember.image),
          paymentOptions,
          registrationFee: fullMember.registration_fee,
          classesPerWeek: fullMember.has_max_number_of_classes_per_week
            ? fullMember.max_number_of_classes_per_week
            : null,
          classesPerMonth: fullMember.has_max_number_of_classes_per_month
            ? fullMember.max_number_of_classes_per_month
            : null,
          isUnlimited,
          numberOfClasses: null,
          validDays: null,
          purchaseUrl: buildPurchaseUrl("membership", fullMember.id, firstOption.id),
          sortInGroup: groupSortKey(rawMember.sort_in_price_group),
          campaign,
        });
      }

      // Process class pass types in this group
      for (const cp of group.class_pass_types) {
        const fullPass = classPasses.find((p) => p.id === cp.id) || cp;

        items.push({
          id: fullPass.id,
          type: "class_pass",
          name: fullPass.name,
          description: fullPass.description || "",
          imageUrl: buildImageUrl(fullPass.image),
          paymentOptions: [{
            id: fullPass.id,
            name: "",
            price: fullPass.price,
            months: null,
            purchaseUrl: buildPurchaseUrl("class_pass", fullPass.id),
          }],
          registrationFee: 0,
          classesPerWeek: null,
          classesPerMonth: null,
          isUnlimited: false,
          numberOfClasses: fullPass.number_of_classes,
          validDays: fullPass.days,
          purchaseUrl: buildPurchaseUrl("class_pass", fullPass.id),
          sortInGroup: groupSortKey(fullPass.sort_in_price_group),
          campaign: null,
        });
      }

      // Sort items within group (fallback to price ascending when sort values are equal)
      items.sort((a, b) => {
        const sortDiff = a.sortInGroup - b.sortInGroup;
        if (sortDiff !== 0) return sortDiff;
        const priceA = a.paymentOptions[0]?.price ?? 0;
        const priceB = b.paymentOptions[0]?.price ?? 0;
        return priceA - priceB;
      });

      return {
        id: group.id,
        name: group.name,
        sort: group.sort,
        showInDefaultPriceList: group.show_in_default_price_list,
        items,
      };
    })
    .filter((g) => g.items.length > 0 && g.showInDefaultPriceList)
    .sort((a, b) => a.sort - b.sort);
}

// --- Hook ---

export function useYogoPricing() {
  return useQuery<PriceGroup[]>({
    queryKey: ["yogo-pricing"],
    queryFn: async () => {
      const [groups, memberships, classPasses] = await Promise.all([
        fetchPriceGroups(),
        fetchMembershipTypes(),
        fetchClassPassTypes(),
      ]);
      return buildPriceGroups(groups, memberships, classPasses);
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    retry: 2,
  });
}

// --- Trial plans (price === 0, from ALL groups including hidden ones) ---

export function useYogoTrialPlans() {
  return useQuery<PricingItem[]>({
    queryKey: ["yogo-trial-plans"],
    queryFn: async () => {
      const [memberships, classPasses] = await Promise.all([
        fetchMembershipTypes(),
        fetchClassPassTypes(),
      ]);

      const trials: PricingItem[] = [];

      for (const m of memberships) {
        const freeOptions = (m.payment_options || []).filter(
          (o) => o.for_sale && o.payment_amount === 0
        );
        if (freeOptions.length === 0) continue;

        trials.push({
          id: m.id,
          type: "membership",
          name: m.name,
          description: m.description || "",
          imageUrl: buildImageUrl(m.image),
          paymentOptions: freeOptions.map((o) => ({
            id: o.id,
            name: o.name,
            price: 0,
            months: o.number_of_months_payment_covers || 1,
            purchaseUrl: buildPurchaseUrl("membership", m.id, o.id),
          })),
          registrationFee: m.registration_fee,
          classesPerWeek: m.has_max_number_of_classes_per_week
            ? m.max_number_of_classes_per_week
            : null,
          classesPerMonth: m.has_max_number_of_classes_per_month
            ? m.max_number_of_classes_per_month
            : null,
          isUnlimited:
            !m.has_max_number_of_classes_per_week && !m.has_max_number_of_classes_per_month,
          numberOfClasses: null,
          validDays: null,
          purchaseUrl: buildPurchaseUrl("membership", m.id, freeOptions[0].id),
          sortInGroup: groupSortKey(m.sort_in_price_group),
          campaign: null,
        });
      }

      for (const cp of classPasses) {
        if (cp.price !== 0) continue;

        trials.push({
          id: cp.id,
          type: "class_pass",
          name: cp.name,
          description: cp.description || "",
          imageUrl: buildImageUrl(cp.image),
          paymentOptions: [{
            id: cp.id,
            name: "",
            price: 0,
            months: null,
            purchaseUrl: buildPurchaseUrl("class_pass", cp.id),
          }],
          registrationFee: 0,
          classesPerWeek: null,
          classesPerMonth: null,
          isUnlimited: false,
          numberOfClasses: cp.number_of_classes,
          validDays: cp.days,
          purchaseUrl: buildPurchaseUrl("class_pass", cp.id),
          sortInGroup: groupSortKey(cp.sort_in_price_group),
          campaign: null,
        });
      }

      return trials;
    },
    staleTime: 10 * 60 * 1000,
    retry: 2,
  });
}
