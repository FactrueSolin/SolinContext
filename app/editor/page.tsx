import { redirect } from 'next/navigation';
import { getDefaultWorkspaceProjectsPath } from '../lib/auth/workspace-home';

export default async function EditorPage() {
  let target = '/';

  try {
    target = await getDefaultWorkspaceProjectsPath();
  } catch {
    target = '/';
  }

  redirect(target);
}
