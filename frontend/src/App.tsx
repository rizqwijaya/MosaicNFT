import { Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import Explore from "./pages/Explore";
import ItemDetail from "./pages/ItemDetail";
import Create from "./pages/Create";
import Collection from "./pages/Collection";
import Profile from "./pages/Profile";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Explore />} />
        <Route path="/item/:collection/:tokenId" element={<ItemDetail />} />
        <Route path="/lazy/:collection/:nonce" element={<ItemDetail />} />
        <Route path="/create" element={<Create />} />
        <Route path="/collection/:address" element={<Collection />} />
        <Route path="/u/:address" element={<Profile />} />
      </Route>
    </Routes>
  );
}
