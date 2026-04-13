import { fireEvent, render, screen } from "@testing-library/react";
import { AssistantHubHeader } from "./AssistantHubHeader";

const mockPush = jest.fn();
const mockClose = jest.fn();
const mockSetContext = jest.fn();
const mockCreateConversation = jest.fn();
const mockSetDraft = jest.fn();
const mockToggleHistory = jest.fn();

const mockUsePathname = jest.fn();
const mockUseSearchParams = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => mockUsePathname(),
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
        close: mockClose,
        setContext: mockSetContext,
        createConversation: mockCreateConversation,
        setDraft: mockSetDraft,
        toggleHistory: mockToggleHistory,
      },
    }),
  };
});

describe("AssistantHubHeader", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUsePathname.mockReturnValue("/manager/bugs");
    mockUseSearchParams.mockReturnValue(new URLSearchParams("tab=open"));
    mockCreateConversation.mockResolvedValue("conv-1");
  });

  it("navigates to full hub with returnTo when maximize is clicked", () => {
    render(<AssistantHubHeader />);

    fireEvent.click(screen.getByRole("button", { name: "Open in full page" }));

    expect(mockClose).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith(
      "/manager/assistant?returnTo=%2Fmanager%2Fbugs%3Ftab%3Dopen",
    );
  });
});
