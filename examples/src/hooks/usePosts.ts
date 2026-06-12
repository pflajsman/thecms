import { useQuery } from '@tanstack/react-query';
import { cms } from '../lib/cms';
import { isConfigured } from '../config';

export function usePosts(page = 1, limit = 10) {
  return useQuery({
    queryKey: ['posts', page, limit],
    queryFn: () => cms.listPosts(page, limit),
    enabled: isConfigured,
  });
}

export function usePost(id: string | undefined) {
  return useQuery({
    queryKey: ['post', id],
    queryFn: () => cms.getPost(id!),
    enabled: isConfigured && !!id,
  });
}

export function usePage(key: string) {
  return useQuery({
    queryKey: ['page', key],
    queryFn: () => cms.getPageByKey(key),
    enabled: isConfigured,
  });
}

export function useContactForm() {
  return useQuery({
    queryKey: ['contact-form'],
    queryFn: () => cms.getContactForm(),
    enabled: isConfigured,
  });
}
