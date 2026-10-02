/** Reserve reading space while data loads, without announcing each decorative placeholder. */
export function LoadingRows({label = 'Loading...', rows = 3}: {label?: string; rows?: number}) {
  return <div className="loading-rows" role="status"><span className="sr-only">{label}</span><div aria-hidden="true">{Array.from({length: rows}, (_, index) => <div className="loading-row" key={index}><span className="skeleton skeleton-dot"/><span className="skeleton skeleton-line"/></div>)}</div></div>;
}
