// An ordinary visit opens the menu. Only an explicit world view resumes it.
export function shouldResumeWorld(url) {
  return new URL(url,'http://localhost').searchParams.get('view')==='world';
}
