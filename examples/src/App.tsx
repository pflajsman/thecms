import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Setup } from './components/Setup';
import { Home } from './pages/Home';
import { Post } from './pages/Post';
import { Trips } from './pages/Trips';
import { Trip } from './pages/Trip';
import { About } from './pages/About';
import { Contact } from './pages/Contact';
import { NotFound } from './pages/NotFound';
import { isConfigured } from './config';
import { ShopPage } from './shop/pages/ShopPage';
import { ProductPage } from './shop/pages/ProductPage';
import { CartPage } from './shop/pages/CartPage';
import { CheckoutPage } from './shop/pages/CheckoutPage';
import { OrderPage } from './shop/pages/OrderPage';
import { TermsPage } from './shop/pages/TermsPage';

export default function App() {
  if (!isConfigured) {
    return <Setup />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="post/:id" element={<Post />} />
          <Route path="trips" element={<Trips />} />
          <Route path="trips/:id" element={<Trip />} />
          <Route path="obchod" element={<ShopPage />} />
          <Route path="obchod/:id" element={<ProductPage />} />
          <Route path="kosik" element={<CartPage />} />
          <Route path="pokladna" element={<CheckoutPage />} />
          <Route path="objednavka/:number" element={<OrderPage />} />
          <Route path="obchodni-podminky" element={<TermsPage />} />
          <Route path="about" element={<About />} />
          <Route path="contact" element={<Contact />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
