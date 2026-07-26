export interface BuildArchiveWorkspaceViewModelInput<
  Theme,
  RemoteData,
  MemoryMode,
  XiaoyeMode,
> {
  readonly theme: Theme;
  readonly date: string;
  readonly mode: MemoryMode;
  readonly subject: string;
  readonly xiaoyeMode: XiaoyeMode;
  readonly remoteData: RemoteData;
}

export function createArchiveWorkspaceViewModelBuilder<
  Theme,
  RemoteData,
  MemoryMode,
  XiaoyeMode,
  ViewModel,
>(
  buildMemoryPage: (
    theme: Theme,
    date: string,
    mode: MemoryMode,
    remoteData: RemoteData,
  ) => ViewModel,
  buildXiaoyePage: (
    theme: Theme,
    date: string,
    mode: XiaoyeMode,
    remoteData: RemoteData,
  ) => ViewModel,
) {
  return ({
    theme,
    date,
    mode,
    subject,
    xiaoyeMode,
    remoteData,
  }: BuildArchiveWorkspaceViewModelInput<
    Theme,
    RemoteData,
    MemoryMode,
    XiaoyeMode
  >) =>
    subject === "Xiaoye"
      ? buildXiaoyePage(
          theme,
          date,
          xiaoyeMode,
          remoteData,
        )
      : buildMemoryPage(theme, date, mode, remoteData);
}
