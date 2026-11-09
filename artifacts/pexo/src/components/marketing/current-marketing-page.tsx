import { useEffect, useRef, type MouseEvent } from "react";
import lottie from "lottie-web";

type CurrentMarketingPageProps = {
  page: string;
  children: React.ReactNode;
};

function revealElement(element: HTMLElement) {
  const computed = window.getComputedStyle(element);
  if (Number.parseFloat(computed.opacity) < 0.99 || (computed.filter && computed.filter !== "none")) {
    element.style.transition = "opacity .6s ease, filter .6s ease";
    element.style.setProperty("opacity", "1", "important");
    element.style.setProperty("filter", "none", "important");
    if (!/splide|swiper/.test(`${element.className}`) && computed.transform !== "none") {
      element.style.transition += ", transform .6s ease";
      element.style.setProperty("transform", "none", "important");
    }
  }
}

function handlePageClick(event: MouseEvent<HTMLDivElement>) {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const burger = target.closest<HTMLButtonElement>(".px-burger");
  if (burger) {
    const nav = burger.closest<HTMLElement>(".px-nav");
    const open = nav?.classList.toggle("open") ?? false;
    burger.setAttribute("aria-expanded", String(open));
    return;
  }

  const dropdownButton = target.closest<HTMLButtonElement>(".px-dd-t");
  if (dropdownButton) {
    const dropdown = dropdownButton.closest<HTMLElement>(".px-dd");
    const willOpen = !dropdown?.classList.contains("open");
    dropdownButton.closest(".px-nav")?.querySelectorAll<HTMLElement>(".px-dd.open").forEach((item) => {
      item.classList.remove("open");
      item.querySelector(".px-dd-t")?.setAttribute("aria-expanded", "false");
    });
    if (willOpen) {
      dropdown?.classList.add("open");
      dropdownButton.setAttribute("aria-expanded", "true");
    }
    return;
  }

  const dropdownToggle = target.closest<HTMLElement>(".w-dropdown-toggle");
  if (dropdownToggle) {
    const dropdown = dropdownToggle.closest<HTMLElement>(".w-dropdown");
    const open = !dropdown?.classList.contains("w--open");
    dropdown?.classList.toggle("w--open", open);
    dropdown?.querySelector<HTMLElement>(".w-dropdown-list")?.classList.toggle("w--open", open);
    dropdownToggle.setAttribute("aria-expanded", String(open));
    return;
  }

  const tab = target.closest<HTMLElement>("[data-w-tab]");
  const tabGroup = tab?.closest<HTMLElement>(".w-tabs");
  if (tab && tabGroup && !tab.classList.contains("w-tab-pane")) {
    event.preventDefault();
    const selected = tab.dataset.wTab;
    tabGroup.querySelectorAll<HTMLElement>(".w-tab-link").forEach((link) => {
      const active = link.dataset.wTab === selected;
      link.classList.toggle("w--current", active);
      link.setAttribute("aria-selected", String(active));
      link.tabIndex = active ? 0 : -1;
    });
    tabGroup.querySelectorAll<HTMLElement>(".w-tab-pane").forEach((pane) => {
      const active = pane.dataset.wTab === selected;
      pane.classList.toggle("w--tab-active", active);
      pane.hidden = !active;
    });
    return;
  }

  const filter = target.closest<HTMLButtonElement>("button[data-f]");
  if (filter) {
    const section = filter.closest<HTMLElement>("section");
    const cards = section?.querySelectorAll<HTMLElement>(".sp-card");
    if (!cards?.length) return;
    const value = filter.dataset.f ?? "all";
    section?.querySelectorAll<HTMLButtonElement>("button[data-f]").forEach((button) => {
      const active = button === filter;
      button.classList.toggle("on", active);
      button.setAttribute("aria-pressed", String(active));
    });
    cards.forEach((card) => {
      const text = card.textContent?.toLowerCase() ?? "";
      const price = Number(text.match(/\$\s*(\d+(?:\.\d+)?)/)?.[1] ?? Number.NaN);
      const visible =
        value === "all" ||
        (value === "popular" && /popular|best seller|hot/.test(text)) ||
        (value === "fast" && /fast|shipping/.test(text)) ||
        (value === "under50" && Number.isFinite(price) && price < 50) ||
        (value === "new" && /\bnew\b/.test(text));
      card.classList.toggle("hide", !visible);
    });
    event.preventDefault();
    return;
  }

  const anchor = target.closest<HTMLAnchorElement>("a[href='#']");
  if (anchor && anchor.textContent?.trim().toLowerCase() === "shuffle") {
    const section = anchor.closest("section");
    const row = section?.querySelector<HTMLElement>(".sp-row, .sp-list, .sp-track, .sp-cards");
    if (row) {
      const cards = Array.from(row.children);
      if (cards.length > 1) {
        const shift = 1 + Math.floor(Math.random() * (cards.length - 1));
        cards.slice(shift).concat(cards.slice(0, shift)).forEach((card) => row.appendChild(card));
      }
      event.preventDefault();
    }
  }
}

export function CurrentMarketingPage({ page, children }: CurrentMarketingPageProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const animations: ReturnType<typeof lottie.loadAnimation>[] = [];
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    root.querySelectorAll<HTMLElement>('[data-animation-type="lottie"][data-src]').forEach((element) => {
      const source = element.dataset.src;
      if (!source) return;
      const path = source.startsWith("/") ? source : `/${source.replace(/^\.?\//, "")}`;
      const animation = lottie.loadAnimation({
        container: element,
        renderer: element.dataset.renderer === "canvas" ? "canvas" : "svg",
        path,
        loop: element.dataset.loop === "1",
        autoplay: !reducedMotion && element.dataset.autoplay !== "0",
        rendererSettings: { preserveAspectRatio: "xMidYMid meet" },
      });
      if (element.dataset.direction === "-1") animation.setDirection(-1);
      animations.push(animation);
    });

    const hidden = Array.from(root.querySelectorAll<HTMLElement>("[data-w-id]")).filter((element) => {
      const style = window.getComputedStyle(element);
      return Number.parseFloat(style.opacity) < 0.99 || (style.filter && style.filter !== "none");
    });

    if (reducedMotion || !("IntersectionObserver" in window)) {
      hidden.forEach(revealElement);
    } else {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          revealElement(entry.target as HTMLElement);
          observer.unobserve(entry.target);
        });
      }, { threshold: 0.12 });
      hidden.forEach((element) => observer.observe(element));
      return () => {
        observer.disconnect();
        animations.forEach((animation) => animation.destroy());
      };
    }

    return () => animations.forEach((animation) => animation.destroy());
  }, [page]);

  return (
    <div
      ref={rootRef}
      className={`export-page current-source-page current-source-page-${page}`}
      data-current-source-page={page}
      onClick={handlePageClick}
    >
      {children}
    </div>
  );
}
