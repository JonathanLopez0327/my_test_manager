import { render, screen } from "@testing-library/react";
import { DataDrivenEditor } from "./DataDrivenEditor";
import { GherkinEditor } from "./GherkinEditor";
import { StepByStepEditor } from "./StepByStepEditor";

describe("Test case editors contrast", () => {
  it("uses surface tokens and readable labels in StepByStepEditor", () => {
    const { container } = render(
      <StepByStepEditor
        steps={[{ id: "step-1", step: "Open notifications", expectedResult: "Page loads" }]}
        onAdd={jest.fn()}
        onRemove={jest.fn()}
        onUpdate={jest.fn()}
      />,
    );

    expect(screen.getByText("Step 1")).toHaveClass("text-ink-muted");
    expect(container.querySelector("div.bg-surface-muted")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Step description")).toHaveClass(
      "bg-surface-elevated",
      "focus:ring-2",
      "focus:ring-brand-100",
    );
    expect(screen.getByPlaceholderText("Expected result")).toHaveClass(
      "bg-surface-elevated",
      "focus:ring-2",
      "focus:ring-brand-100",
    );
  });

  it("uses surface tokens and accessible focus styles in GherkinEditor", () => {
    const { container } = render(
      <GherkinEditor
        clauses={[{ id: "clause-1", keyword: "Given", text: "the user is authenticated" }]}
        onAdd={jest.fn()}
        onRemove={jest.fn()}
        onUpdate={jest.fn()}
      />,
    );

    expect(container.querySelector("div.bg-surface-muted")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveClass(
      "bg-surface-elevated",
      "focus:ring-2",
      "focus:ring-brand-100",
    );
    expect(screen.getByPlaceholderText("the user is on the login page")).toHaveClass(
      "bg-surface-elevated",
      "focus:ring-2",
      "focus:ring-brand-100",
    );
  });

  it("uses consistent contrast tokens in DataDrivenEditor template and examples table", () => {
    const { container } = render(
      <DataDrivenEditor
        template={[{ id: "tpl-1", keyword: "Given", text: "the user enters <username>" }]}
        examples={{ columns: ["username"], rows: [["qa-user"]] }}
        onAddClause={jest.fn()}
        onRemoveClause={jest.fn()}
        onUpdateClause={jest.fn()}
        onUpdateExamples={jest.fn()}
      />,
    );

    expect(container.querySelector("div.bg-surface-muted")).toBeInTheDocument();
    expect(container.querySelector("tr.bg-surface-muted")).toBeInTheDocument();
    expect(screen.getByDisplayValue("username")).toHaveClass(
      "bg-surface-elevated",
      "focus:ring-2",
      "focus:ring-brand-100",
    );
    expect(screen.getByDisplayValue("qa-user")).toHaveClass(
      "bg-surface-elevated",
      "focus:ring-2",
      "focus:ring-brand-100",
    );
  });
});
