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

export function useTrips(page = 1, limit = 20) {
  return useQuery({
    queryKey: ['trips', page, limit],
    queryFn: () => cms.listTrips(page, limit),
    enabled: isConfigured,
  });
}

export function useTrip(id: string | undefined) {
  return useQuery({
    queryKey: ['trip', id],
    queryFn: () => cms.getTrip(id!),
    enabled: isConfigured && !!id,
  });
}

/** Resolve a GPX reference (URL or media id) to a downloadable file. */
export function useMedia(ref: string | undefined) {
  return useQuery({
    queryKey: ['media', ref],
    queryFn: () => cms.resolveMedia(ref!),
    enabled: isConfigured && !!ref,
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
