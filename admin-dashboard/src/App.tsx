import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import ProtectedRoute from "./components/ProtectedRoute";
import AdminLayout from "./layout/AdminLayout";
import DeliveryLayout from "./layout/DeliveryLayout";
import CouponsPage from "./pages/CouponsPage";
import DashboardPage from "./pages/DashboardPage";
import DeliveryDashboardPage from "./pages/DeliveryDashboardPage";
import DeliveryPartnersPage from "./pages/DeliveryPartnersPage";
import LocationsPage from "./pages/LocationsPage";
import LoginPage from "./pages/LoginPage";
import OrdersPage from "./pages/OrdersPage";
import PlansPage from "./pages/PlansPage";
import ProductsPage from "./pages/ProductsPage";
import SubscriptionsPage from "./pages/SubscriptionsPage";
import UsersPage from "./pages/UsersPage";
import DeliveryReviewsPage from "./pages/DeliveryReviewsPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          element={
            <ProtectedRoute allowedRoles={["admin"]} />
          }
        >
          <Route element={<AdminLayout />}>
            <Route
              index
              element={<Navigate to="/dashboard" replace />}
            />

            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route
              path="/delivery-partners"
              element={<DeliveryPartnersPage />}
            />
            <Route path="/coupons" element={<CouponsPage />} />
            <Route path="/locations" element={<LocationsPage />} />
            <Route path="/plans" element={<PlansPage />} />
            <Route
              path="/subscriptions"
              element={<SubscriptionsPage />}
            />
            <Route path="/users" element={<UsersPage />} />
            <Route
  path="/reviews"
  element={<DeliveryReviewsPage />}
/>
          </Route>
        </Route>

        <Route
          element={
            <ProtectedRoute allowedRoles={["delivery"]} />
          }
        >
          <Route element={<DeliveryLayout />}>
            <Route
              path="/delivery"
              element={<DeliveryDashboardPage />}
            />
          </Route>
        </Route>

        <Route
          path="*"
          element={<Navigate to="/" replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}
