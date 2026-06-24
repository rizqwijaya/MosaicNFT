import { Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import Explore from "./pages/Explore";
import ItemDetail from "./pages/ItemDetail";
import Airdrop, { AirdropDetail } from "./pages/Airdrop";
import Create from "./pages/Create";
import Collection from "./pages/Collection";
import Profile from "./pages/Profile";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Explore />} />
        <Route path="/item/:collection/:tokenId" element={<ItemDetail />} />
        <Route path="/airdrop" element={<Airdrop />} />
        <Route path="/airdrop/:id" element={<AirdropDetail />} />
        <Route path="/create" element={<Create />} />
        <Route path="/collection/:address" element={<Collection />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/u/:address" element={<Profile />} />
      </Route>
    </Routes>
  );
}
