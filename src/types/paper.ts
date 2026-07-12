export type Paper = {
  id: string;
  arxivId: string;
  title: string;
  abstract: string;
  authors: string[];
  categories: string[];
  published: string;
  updated: string;
  absUrl: string;
  pdfUrl: string;
};

/** Any arXiv category id (`cs.LG`) or `"all"`. */
export type FeedCategory = string;
