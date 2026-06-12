export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <div className="container-wide inner">
        <span>© {year} Pavel Flajšman</span>
        <span>flajsman.cz — běží na TheCMS</span>
      </div>
    </footer>
  );
}
