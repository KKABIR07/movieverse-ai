import { BrowsePageSkeleton } from '@/components/browse/BrowseStates';

export default function Loading() {
  return <BrowsePageSkeleton kind="person" count={24} />;
}
