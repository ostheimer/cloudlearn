export function buildLibraryCourseRoute(id: string, title: string) {
  return `/library-course/${id}?title=${encodeURIComponent(title)}`;
}

export function buildLibraryFolderRoute(id: string, title: string) {
  return `/library-folder/${id}?title=${encodeURIComponent(title)}`;
}
