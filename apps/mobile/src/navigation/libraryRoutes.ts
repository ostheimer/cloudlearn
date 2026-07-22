export function buildLibraryFolderRoute(id: string, title: string) {
  return `/library-folder/${id}?title=${encodeURIComponent(title)}`;
}
