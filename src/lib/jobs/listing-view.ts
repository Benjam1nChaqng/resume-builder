export const JOB_LISTING_SORTS = ["relevance", "newest", "company"] as const;

export type JobListingSort = (typeof JOB_LISTING_SORTS)[number];

type ListingViewItem = {
  id: string;
  status: string;
  matchScore: number;
  discoveredAt: Date;
  company: string | null;
  title: string;
};

function compareText(left: string | null, right: string | null): number {
  const normalizedLeft = (left ?? "").trim().toLowerCase();
  const normalizedRight = (right ?? "").trim().toLowerCase();
  if (normalizedLeft < normalizedRight) return -1;
  if (normalizedLeft > normalizedRight) return 1;
  return 0;
}

function compareNewest(left: ListingViewItem, right: ListingViewItem): number {
  return right.discoveredAt.getTime() - left.discoveredAt.getTime();
}

function compareListings(
  left: ListingViewItem,
  right: ListingViewItem,
  sort: JobListingSort,
): number {
  if (sort === "newest") {
    return (
      compareNewest(left, right) ||
      right.matchScore - left.matchScore ||
      compareText(left.title, right.title) ||
      compareText(left.id, right.id)
    );
  }

  if (sort === "company") {
    return (
      compareText(left.company, right.company) ||
      compareText(left.title, right.title) ||
      compareNewest(left, right) ||
      compareText(left.id, right.id)
    );
  }

  return (
    right.matchScore - left.matchScore ||
    compareNewest(left, right) ||
    compareText(left.title, right.title) ||
    compareText(left.id, right.id)
  );
}

export function parseJobListingSort(value: string | undefined): JobListingSort {
  return JOB_LISTING_SORTS.includes(value as JobListingSort)
    ? (value as JobListingSort)
    : "relevance";
}

export function createJobListingView<T extends ListingViewItem>(
  listings: readonly T[],
  {
    status,
    sort,
    page,
    pageSize = 20,
  }: {
    status: string;
    sort: JobListingSort;
    page: number;
    pageSize?: number;
  },
) {
  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new Error("Listing page size must be a positive integer.");
  }

  const filtered =
    status === "all"
      ? [...listings]
      : listings.filter((listing) => listing.status === status);
  filtered.sort((left, right) => compareListings(left, right, sort));

  const total = filtered.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const requestedPage = Number.isInteger(page) && page > 0 ? page : 1;
  const currentPage = Math.min(requestedPage, pageCount);
  const offset = (currentPage - 1) * pageSize;
  const items = filtered.slice(offset, offset + pageSize);

  return {
    items,
    total,
    page: currentPage,
    pageCount,
    rangeStart: total === 0 ? 0 : offset + 1,
    rangeEnd: offset + items.length,
    hasPrevious: currentPage > 1,
    hasNext: currentPage < pageCount,
  };
}
