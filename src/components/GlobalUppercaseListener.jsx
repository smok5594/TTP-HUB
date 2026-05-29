"use client";

import { useEffect } from "react";

export default function GlobalUppercaseListener() {
  useEffect(() => {
    const handleInput = (e) => {
      const target = e.target;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA") &&
        target.type !== "password" &&
        target.type !== "email" &&
        target.type !== "time" &&
        target.type !== "date" &&
        !target.dataset.noUppercase &&
        !target.classList.contains("no-uppercase")
      ) {
        const originalValue = target.value;
        const upperValue = originalValue.toUpperCase();
        if (originalValue !== upperValue) {
          const start = target.selectionStart;
          const end = target.selectionEnd;
          
          // React custom setter hook trick to trigger state updates properly on controlled inputs
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            Object.getPrototypeOf(target),
            "value"
          )?.set;
          
          if (nativeInputValueSetter) {
            nativeInputValueSetter.call(target, upperValue);
          } else {
            target.value = upperValue;
          }

          // Trigger React's onChange tracking
          const ev = new Event("input", { bubbles: true });
          target.dispatchEvent(ev);

          // Restore cursor selection so it doesn't jump to the end
          if (start !== null && end !== null) {
            target.setSelectionRange(start, end);
          }
        }
      }
    };

    document.addEventListener("input", handleInput, true);
    return () => {
      document.removeEventListener("input", handleInput, true);
    };
  }, []);

  return null;
}
