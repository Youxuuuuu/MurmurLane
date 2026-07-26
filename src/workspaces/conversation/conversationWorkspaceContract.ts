export interface ConversationWorkspaceOutput<
  ViewModel,
  Commands,
> {
  readonly viewModel: ViewModel;
  readonly commands: Commands;
}

export function createConversationWorkspaceOutput<
  ViewModel,
  Commands,
>(
  viewModel: ViewModel,
  commands: Commands,
): ConversationWorkspaceOutput<ViewModel, Commands> {
  return Object.freeze({ viewModel, commands });
}
