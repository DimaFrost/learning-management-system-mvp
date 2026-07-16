type LookupMode = 'isbn' | 'search';

type BookResult = {
  title: string;
  subtitle: string | null;
  authors: string[];
  description: string | null;
  publisher: string | null;
  publishedDate: string | null;
  pageCount: number | null;
  isbn10: string | null;
  isbn13: string | null;
  coverUrl: string | null;
  sourceProvider: string;
  sourceId: string | null;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function cleanIsbn(value: string) {
  return value.replace(/[^0-9Xx]/g, '').toUpperCase();
}

function normalizeGoogleBook(item: any): BookResult | null {
  const info = item?.volumeInfo;
  if (!info?.title) return null;
  const identifiers = Array.isArray(info.industryIdentifiers) ? info.industryIdentifiers : [];
  const isbn10 = identifiers.find((entry: any) => entry.type === 'ISBN_10')?.identifier ?? null;
  const isbn13 = identifiers.find((entry: any) => entry.type === 'ISBN_13')?.identifier ?? null;
  return {
    title: info.title,
    subtitle: info.subtitle ?? null,
    authors: Array.isArray(info.authors) ? info.authors : [],
    description: info.description ?? null,
    publisher: info.publisher ?? null,
    publishedDate: info.publishedDate ?? null,
    pageCount: Number.isFinite(info.pageCount) ? info.pageCount : null,
    isbn10,
    isbn13,
    coverUrl: info.imageLinks?.thumbnail?.replace('http://', 'https://') ?? info.imageLinks?.smallThumbnail?.replace('http://', 'https://') ?? null,
    sourceProvider: 'google_books',
    sourceId: item.id ?? null,
  };
}

function normalizeOpenLibrary(doc: any, sourceId: string | null): BookResult | null {
  const title = doc?.title;
  if (!title) return null;
  const isbn = Array.isArray(doc.isbn) ? doc.isbn : [];
  const isbn10 = isbn.find((value: string) => cleanIsbn(value).length === 10) ?? null;
  const isbn13 = isbn.find((value: string) => cleanIsbn(value).length === 13) ?? null;
  const coverId = doc.cover_i ?? doc.cover?.large ?? null;
  return {
    title,
    subtitle: doc.subtitle ?? null,
    authors: Array.isArray(doc.author_name) ? doc.author_name : [],
    description: typeof doc.description === 'string' ? doc.description : null,
    publisher: Array.isArray(doc.publisher) ? doc.publisher[0] ?? null : null,
    publishedDate: doc.first_publish_year ? String(doc.first_publish_year) : null,
    pageCount: Number.isFinite(doc.number_of_pages_median) ? doc.number_of_pages_median : null,
    isbn10,
    isbn13,
    coverUrl: typeof coverId === 'number' ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : null,
    sourceProvider: 'open_library',
    sourceId,
  };
}

async function googleLookup(query: string, mode: LookupMode): Promise<BookResult[]> {
  const q = mode === 'isbn' ? `isbn:${cleanIsbn(query)}` : query;
  const url = new URL('https://www.googleapis.com/books/v1/volumes');
  url.searchParams.set('q', q);
  url.searchParams.set('maxResults', '8');
  url.searchParams.set('printType', 'books');
  const apiKey = Deno.env.get('GOOGLE_BOOKS_API_KEY');
  if (apiKey) url.searchParams.set('key', apiKey);

  const response = await fetch(url);
  if (!response.ok) return [];
  const data = await response.json();
  return (Array.isArray(data.items) ? data.items : [])
    .map(normalizeGoogleBook)
    .filter(Boolean) as BookResult[];
}

async function openLibraryLookup(query: string, mode: LookupMode): Promise<BookResult[]> {
  if (mode === 'isbn') {
    const isbn = cleanIsbn(query);
    const url = `https://openlibrary.org/isbn/${isbn}.json`;
    const response = await fetch(url);
    if (!response.ok) return [];
    const data = await response.json();
    return [normalizeOpenLibrary({
      ...data,
      isbn: [isbn],
      author_name: [],
      publisher: data.publishers,
      first_publish_year: data.publish_date,
      number_of_pages_median: data.number_of_pages,
      cover_i: data.covers?.[0],
    }, data.key ?? isbn)].filter(Boolean) as BookResult[];
  }

  const url = new URL('https://openlibrary.org/search.json');
  url.searchParams.set('q', query);
  url.searchParams.set('limit', '8');
  const response = await fetch(url);
  if (!response.ok) return [];
  const data = await response.json();
  return (Array.isArray(data.docs) ? data.docs : [])
    .map((doc: any) => normalizeOpenLibrary(doc, doc.key ?? null))
    .filter(Boolean) as BookResult[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const query = String(body.query ?? '').trim();
    const mode: LookupMode = body.mode === 'isbn' ? 'isbn' : 'search';

    if (!query) {
      return new Response(JSON.stringify({ results: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const google = await googleLookup(query, mode);
    const openLibrary = google.length > 0 ? [] : await openLibraryLookup(query, mode);
    const results = [...google, ...openLibrary].slice(0, 8);

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('book-lookup failed', error);
    return new Response(JSON.stringify({ results: [], error: 'Lookup failed' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
