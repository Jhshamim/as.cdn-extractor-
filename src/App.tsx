import { useState } from 'react';

export default function App() {
  const [url, setUrl] = useState('https://as-cdn21.top/video/2fdf132bc31b24922316fa3a6ec7c196');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const handleExtract = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const response = await fetch(`/api/extract?url=${encodeURIComponent(url)}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to extract');
      }
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 p-8 font-sans">
      <div className="mx-auto max-w-3xl bg-white p-8 rounded-2xl shadow-sm border border-neutral-200">
        <h1 className="text-2xl font-semibold text-neutral-900 mb-6">HLS Extractor API</h1>
        
        <div className="mb-6">
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            Target Video URL
          </label>
          <div className="flex gap-4">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="flex-1 px-4 py-2 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="https://example.com/video/..."
            />
            <button
              onClick={handleExtract}
              disabled={loading || !url}
              className="px-6 py-2 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Extracting...' : 'Extract'}
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 mb-6 bg-red-50 text-red-700 rounded-xl border border-red-100">
            {error}
          </div>
        )}

        {result && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-medium text-neutral-700 mb-2">Combined M3U8 URL</h3>
              <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 break-all font-mono text-sm text-indigo-600">
                {result.combinedM3u8Url || 'Not found'}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-medium text-neutral-700 mb-2">Video HLS URL</h3>
                <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 break-all font-mono text-xs text-neutral-600 h-full">
                  {result.videoUrl || 'Not found'}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium text-neutral-700 mb-2">Audio HLS URL</h3>
                <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 break-all font-mono text-xs text-neutral-600 h-full">
                  {result.audioUrl || 'Not found'}
                </div>
              </div>
            </div>

            {result.allHlsUrls && result.allHlsUrls.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-neutral-700 mb-2">All Discovered HLS URLs</h3>
                <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 font-mono text-xs text-neutral-600">
                  <ul className="list-disc pl-4 space-y-2">
                    {result.allHlsUrls.map((u: string, i: number) => (
                      <li key={i} className="break-all">{u}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
