export type LangGraphConfig = {
  configurable: {
    project_id?: string;
    mtm_api_token: string;
    thread_id: string;
    entity_context?: unknown;
  };
};

/**
 * Build the `config.configurable` block for every LangGraph call (initial run,
 * resume after interrupt, any future ones). The backend does not persist the
 * user's `mtm_api_token` between turns by design (ephemeral-injection defense),
 * so every POST must re-send the token in the same shape.
 */
export function buildLangGraphConfig(
  mtmApiToken: string,
  projectId: string | null | undefined,
  threadId: string,
  options?: { entityContext?: unknown },
): LangGraphConfig {
  return {
    configurable: {
      ...(projectId ? { project_id: projectId } : {}),
      mtm_api_token: mtmApiToken,
      thread_id: threadId,
      ...(options?.entityContext ? { entity_context: options.entityContext } : {}),
    },
  };
}
