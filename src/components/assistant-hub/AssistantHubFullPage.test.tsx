import { render } from "@testing-library/react";
import { AssistantHubFullPage } from "./AssistantHubFullPage";

const mockSetContext = jest.fn();
const mockClose = jest.fn();

jest.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock("@/lib/assistant-hub", () => ({
  useAssistantHub: () => ({
    state: {
      conversationMessages: {},
      activeConversationId: "",
      conversations: [],
      threadDocuments: {},
    },
    actions: {
      setContext: mockSetContext,
      close: mockClose,
    },
  }),
}));

jest.mock("./AssistantHubMessages", () => ({
  AssistantHubMessages: () => <div>messages</div>,
}));
jest.mock("./AssistantHubDocuments", () => ({
  AssistantHubDocuments: () => <div>documents</div>,
}));
jest.mock("./AssistantHubInput", () => ({
  AssistantHubInput: () => <div>input</div>,
}));
jest.mock("./AssistantHubConversationList", () => ({
  AssistantHubConversationList: () => <div>history</div>,
}));
jest.mock("./AssistantHubFullPageHeader", () => ({
  AssistantHubFullPageHeader: () => <div>header</div>,
}));

describe("AssistantHubFullPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("uses a full-height overflow-hidden layout container", () => {
    const { container } = render(<AssistantHubFullPage />);
    expect(container.firstChild).toHaveClass("h-full", "min-h-0", "w-full", "overflow-hidden");
  });
});
