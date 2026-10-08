import { useEffect, useRef, type RefObject } from 'react';

type ModalBehaviorOptions = {
  // Called when the person presses Escape.
  onRequestClose: () => void;
  // The element that receives focus when the modal opens.
  initialFocusRef?: RefObject<HTMLElement | null>;
};

// Elements the Tab key can land on.
const FOCUSABLE_SELECTOR =
  'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

// What every modal needs so keyboard and screen-reader users can use it.
// Call it from a component that is mounted only while the modal is open:
//
//   - the page behind stops scrolling
//   - focus moves into the modal, and returns to where it was on close
//   - Tab stays inside the modal
//   - Escape asks to close
//
// Returns the ref to put on the modal's panel element.
function useModalBehavior<T extends HTMLElement>({
  onRequestClose,
  initialFocusRef,
}: ModalBehaviorOptions) {
  const panelRef = useRef<T>(null);

  // Keep the latest callback in a ref so the effect below can run once and
  // still call the current function.
  const onRequestCloseRef = useRef(onRequestClose);
  onRequestCloseRef.current = onRequestClose;

  useEffect(() => {
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    initialFocusRef?.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onRequestCloseRef.current();
        return;
      }

      if (event.key !== 'Tab' || !panelRef.current) return;

      const focusable = panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);

      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;

      if (previouslyFocused?.isConnected) {
        previouslyFocused.focus();
      }
    };
  }, [initialFocusRef]);

  return panelRef;
}

export default useModalBehavior;
