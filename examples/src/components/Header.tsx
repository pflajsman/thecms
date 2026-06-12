import { NavLink } from 'react-router-dom';

export function Header() {
  return (
    <header className="site-header">
      <div className="container-wide inner">
        <NavLink to="/" className="logo">
          flajsman<span className="dot">.cz</span>
        </NavLink>
        <nav className="site-nav">
          <NavLink to="/" end>
            psaní
          </NavLink>
          <NavLink to="/about">o mně</NavLink>
          <NavLink to="/contact">kontakt</NavLink>
        </nav>
      </div>
    </header>
  );
}
