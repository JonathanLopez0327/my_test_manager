import { createRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { Modal } from "./Modal";

describe("Modal", () => {
  it("closes on Escape only when closeOnEsc is enabled", () => {
    const onClose = jest.fn();
    const { rerender } = render(
      <Modal open title="Esc modal" onClose={onClose}>
        <button type="button">Action</button>
      </Modal>,
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();

    rerender(
      <Modal open title="Esc modal" onClose={onClose} closeOnEsc>
        <button type="button">Action</button>
      </Modal>,
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("traps focus when trapFocus is enabled", () => {
    render(
      <Modal open title="Focus modal" onClose={() => undefined} trapFocus>
        <button type="button">First</button>
        <button type="button">Last</button>
      </Modal>,
    );

    const close = screen.getByRole("button", { name: "Close" });
    const last = screen.getByRole("button", { name: "Last" });

    last.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(close);

    close.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it("moves focus to initialFocusRef when provided", () => {
    const inputRef = createRef<HTMLInputElement>();

    render(
      <Modal
        open
        title="Initial focus"
        onClose={() => undefined}
        initialFocusRef={inputRef}
      >
        <input ref={inputRef} aria-label="Workspace input" />
      </Modal>,
    );

    expect(document.activeElement).toBe(screen.getByLabelText("Workspace input"));
  });
});
