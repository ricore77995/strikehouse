import { useQuery } from "@tanstack/react-query";

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

function getYogoServer(): string {
  return (window as unknown as Record<string, string>).YOGO_APP_SERVER || "";
}

function getApiHeaders(): Record<string, string> {
  return {
    accept: "application/json",
  };
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
  const server = getYogoServer();
  const base = `https://${server}/frontend/index.html#`;
  if (type === "class_pass") {
    return `${base}/class-pass-type/${itemId}/buy`;
  }
  if (paymentOptionId) {
    return `${base}/membership-type/${itemId}/payment-option/${paymentOptionId}/buy`;
  }
  return `${base}/membership-type/${itemId}/buy`;
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
        const paymentOptions = (fullMember.payment_options || []).filter((o) => o.for_sale);
        const firstOption = paymentOptions[0];

        if (!firstOption) continue;

        const isUnlimited = !fullMember.has_max_number_of_classes_per_week;

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
          paymentOptions: paymentOptions
            .map((o) => ({
              id: o.id,
              name: o.name,
              price: o.payment_amount,
              purchaseUrl: buildPurchaseUrl("membership", fullMember.id, o.id),
            }))
            .sort((a, b) => a.price - b.price),
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
          sortInGroup: rawMember.sort_in_price_group,
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
            purchaseUrl: buildPurchaseUrl("class_pass", fullPass.id),
          }],
          registrationFee: 0,
          classesPerWeek: null,
          classesPerMonth: null,
          isUnlimited: false,
          numberOfClasses: fullPass.number_of_classes,
          validDays: fullPass.days,
          purchaseUrl: buildPurchaseUrl("class_pass", fullPass.id),
          sortInGroup: fullPass.sort_in_price_group,
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
            purchaseUrl: buildPurchaseUrl("membership", m.id, o.id),
          })),
          registrationFee: m.registration_fee,
          classesPerWeek: m.has_max_number_of_classes_per_week
            ? m.max_number_of_classes_per_week
            : null,
          classesPerMonth: m.has_max_number_of_classes_per_month
            ? m.max_number_of_classes_per_month
            : null,
          isUnlimited: !m.has_max_number_of_classes_per_week,
          numberOfClasses: null,
          validDays: null,
          purchaseUrl: buildPurchaseUrl("membership", m.id, freeOptions[0].id),
          sortInGroup: m.sort_in_price_group,
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
            purchaseUrl: buildPurchaseUrl("class_pass", cp.id),
          }],
          registrationFee: 0,
          classesPerWeek: null,
          classesPerMonth: null,
          isUnlimited: false,
          numberOfClasses: cp.number_of_classes,
          validDays: cp.days,
          purchaseUrl: buildPurchaseUrl("class_pass", cp.id),
          sortInGroup: cp.sort_in_price_group,
          campaign: null,
        });
      }

      return trials;
    },
    staleTime: 10 * 60 * 1000,
    retry: 2,
  });
}
