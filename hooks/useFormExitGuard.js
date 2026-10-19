import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/router";

export function useFormExitGuard(form, onClose) {
  const router = useRouter();
  const initialForm = useRef(JSON.stringify(form));
  const isDirty = JSON.stringify(form) !== initialForm.current;

  const requestClose = useCallback((force = false) => {
    if (!force && isDirty && !window.confirm("Vous avez des modifications non enregistrées. Voulez-vous vraiment quitter ce formulaire ? Les informations saisies seront perdues.")) return;
    onClose();
  }, [isDirty, onClose]);

  useEffect(() => {
    if (!isDirty) return undefined;
    const warnBeforeUnload = event => {
      event.preventDefault();
      event.returnValue = "";
    };
    const closeOnEscape = event => {
      if (event.key === "Escape") requestClose();
    };
    const confirmRouteChange = url => {
      if (window.confirm("Vous avez des modifications non enregistrées. Voulez-vous vraiment quitter ce formulaire ? Les informations saisies seront perdues.")) return;
      router.events.emit("routeChangeError");
      throw new Error(`Navigation vers ${url} annulée : formulaire non enregistré.`);
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    window.addEventListener("keydown", closeOnEscape);
    router.events.on("routeChangeStart", confirmRouteChange);
    return () => {
      window.removeEventListener("beforeunload", warnBeforeUnload);
      window.removeEventListener("keydown", closeOnEscape);
      router.events.off("routeChangeStart", confirmRouteChange);
    };
  }, [isDirty, requestClose, router.events]);

  return requestClose;
}