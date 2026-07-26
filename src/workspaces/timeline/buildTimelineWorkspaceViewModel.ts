export function createTimelineWorkspaceViewModelBuilder<
  Theme,
  RemoteData,
  ViewModel,
>(
  buildPage: (
    theme: Theme,
    date: string,
    remoteData: RemoteData,
  ) => ViewModel,
) {
  return (
    theme: Theme,
    date: string,
    remoteData: RemoteData,
  ) => buildPage(theme, date, remoteData);
}
