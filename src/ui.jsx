import { useEffect, useRef } from "react";

// Only the top-most overlay reacts to Escape (so closing a modal doesn't also close the drawer behind it)
const stack = [];
function useEscape(onClose) {
  const ref = useRef(onClose);
  ref.current = onClose;
  useEffect(() => {
    const token = {};
    stack.push(token);
    const onKey = (e) => e.key === "Escape" && stack[stack.length - 1] === token && ref.current();
    window.addEventListener("keydown", onKey);
    return () => {
      stack.splice(stack.indexOf(token), 1);
      window.removeEventListener("keydown", onKey);
    };
  }, []);
}

export function Drawer({ children, onClose }) {
  useEscape(onClose);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="drawer" role="dialog" aria-modal="true">
        <button className="close" onClick={onClose} aria-label="Close">✕</button>
        {children}
      </aside>
    </div>
  );
}

export function Modal({ title, children, onClose }) {
  useEscape(onClose);
  return (
    <div className="overlay center-modal" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

export const Badge = ({ className = "", children }) => <span className={`badge ${className}`}>{children}</span>;
