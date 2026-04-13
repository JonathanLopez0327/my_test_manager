import { fireEvent, render, screen } from "@testing-library/react";
import { AssistantHubFullPageHeader } from "./AssistantHubFullPageHeader";

const mockPush = jest.fn();
const mockOpen = jest.fn();
const mockSetContext = jest.fn();
const mockCreateConversation = jest.fn();
const mockSetDraft = jest.fn();
const mockToggleHistory = jest.fn();
const mockUseSearchParams = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => mockUseSearchParams(),
}));

jest.mock("@/lib/assistant-hub", () => {
  const actual = jest.requireActual("@/lib/assistant-hub");
  return {
    ...actual,
    useAssistantHub: () => ({
      state: {
        context: { type: "global" },
        showHistory: false,
      },
      actions: {
        open: mockOpen,
        setContext: mockSetContext,
        createConversation: mockCreateConversation,
        setDraft: mockSetDraft,
        toggleHistory: mockToggleHistory,
      },
    }),
  };
});

describe("AssistantHubFullPageHeader", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateConversation.mockResolvedValue("conv-1");
  });

  it("minimizes to right panel and navigates to returnTo path", () => {
    mockUseSearchParams.mockReturnValue(
      new URLSearchParams("returnTo=%2Fmanager%2Fbugs%3Ftab%3Dopen"),
    );

    render(<AssistantHubFullPageHeader />);

    fireEvent.click(screen.getByRole("button", { name: "Minimize to panel" }));

    expect(mockOpen).toHaveBeenCalledWith({ type: "global" });
    expect(mockPush).toHaveBeenCalledWith("/manager/bugs?tab=open");
  });
});
