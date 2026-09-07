import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SectionHeader from "@/components/SectionHeader";
import { useYogoProducts, type Product } from "@/hooks/useYogoProducts";
import { yogoProfileUrl } from "@/lib/yogoLinks";

function Steps() {
  const { t } = useTranslation();
  const steps = [
    { title: t("shop.stepBuyTitle"), body: t("shop.stepBuyBody") },
    { title: t("shop.stepShowTitle"), body: t("shop.stepShowBody") },
    { title: t("shop.stepPickTitle"), body: t("shop.stepPickBody") },
  ];

  return (
    <div className="mb-12 grid gap-4 sm:grid-cols-3">
      {steps.map((step) => (
        <div key={step.title} className="rounded-2xl border border-border/60 bg-card p-5">
          <div className="mb-3 h-px w-8 bg-accent" />
          <h3 className="mb-2 font-mono text-xs uppercase tracking-[0.18em] text-foreground">
            {step.title}
          </h3>
          <p className="text-sm leading-relaxed text-muted-foreground">{step.body}</p>
        </div>
      ))}
    </div>
  );
}

function ProductCard({ product }: { product: Product }) {
  const { t } = useTranslation();

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card transition-colors hover:border-accent/50">
      <div className="aspect-square overflow-hidden bg-secondary">
        {product.imageUrl && (
          <img
            src={product.imageUrl}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-sm uppercase tracking-wider text-foreground">{product.name}</h3>
        <p className="mt-1 text-xl font-semibold text-foreground">{product.price}€</p>
        {product.needsSizeAtPickup && (
          <p className="mt-1 text-xs text-muted-foreground">{t("shop.sizeAtPickup")}</p>
        )}

        <a
          href={product.purchaseUrl}
          target="_blank"
          rel="noopener noreferrer"
          data-yogo-parsed="true"
          className="mt-4 flex items-center justify-between gap-3 rounded-full border border-border/60 px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-foreground transition-all hover:border-accent hover:text-accent"
        >
          <span>{t("shop.buy")}</span>
          <span aria-hidden>→</span>
        </a>
      </div>
    </div>
  );
}

const Shop = () => {
  const { data: products, isLoading, error } = useYogoProducts();
  const { t } = useTranslation();

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Header />

      <main className="flex-1 px-6 pb-20 pt-28">
        <div className="container mx-auto">
          <SectionHeader
            title={t("shop.title")}
            description={t("shop.description")}
            titleClassName="text-accent"
          />

          <Steps />

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-accent" />
            </div>
          ) : error || !products?.length ? (
            <p className="py-20 text-center text-sm text-muted-foreground">{t("shop.empty")}</p>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              // Fills as many columns as fit, then wraps — no horizontal scrolling.
              className="grid grid-cols-2 gap-4 sm:grid-cols-[repeat(auto-fill,minmax(200px,1fr))]"
            >
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </motion.div>
          )}

          <p className="mt-10 text-center">
            <a
              href={yogoProfileUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground underline decoration-border underline-offset-4 transition-colors hover:text-accent"
            >
              {t("shop.myAccount")}
            </a>
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Shop;
