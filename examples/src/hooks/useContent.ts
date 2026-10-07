import { useQuery } from '@tanstack/react-query';
import { cms } from '../lib/cms';
import { isConfigured } from '../config';
import { useLang } from '../i18n';

export function useProjects() {
  const { lang } = useLang();
  return useQuery({
    queryKey: ['projects', lang],
    queryFn: () => cms.listProjects(lang),
    enabled: isConfigured,
  });
}

export function useProject(id: string | undefined) {
  const { lang } = useLang();
  return useQuery({
    queryKey: ['project', lang, id],
    queryFn: () => cms.getProject(lang, id!),
    enabled: isConfigured && !!id,
  });
}

export function usePage(key: string) {
  const { lang } = useLang();
  return useQuery({
    queryKey: ['page', lang, key],
    queryFn: () => cms.getPageByKey(lang, key),
    enabled: isConfigured,
  });
}

/** Resolves a media id to its file; media are the same in every language. */
export function useMedia(id: string | undefined) {
  return useQuery({
    queryKey: ['media', id],
    queryFn: () => cms.getMedia(id!),
    enabled: isConfigured && !!id,
    staleTime: Infinity,
  });
}
