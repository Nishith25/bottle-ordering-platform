import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import ProtectedRoute from "./components/ProtectedRoute";

import AdminLayout from "./layout/AdminLayout";
import DeliveryLayout from "./layout/DeliveryLayout";

import BatchLabelsPage from "./pages/BatchLabelsPage";
import BatchRegisterPage from "./pages/BatchRegisterPage";
import CostingPage from "./pages/CostingPage";
import CouponsPage from "./pages/CouponsPage";
import DashboardPage from "./pages/DashboardPage";
import DeliveryDashboardPage from "./pages/DeliveryDashboardPage";
import DeliveryPartnersPage from "./pages/DeliveryPartnersPage";
import DeliveryReviewsPage from "./pages/DeliveryReviewsPage";
import DeliverySlotsPage from "./pages/DeliverySlotsPage";
import FollowUpsPage from "./pages/FollowUpsPage";
import InvoicePrintPage from "./pages/InvoicePrintPage";
import LocationsPage from "./pages/LocationsPage";
import LoginPage from "./pages/LoginPage";
import OperationsPage from "./pages/OperationsPage";
import OrdersPage from "./pages/OrdersPage";
import PlansPage from "./pages/PlansPage";
import ProductsPage from "./pages/ProductsPage";
import ProductionPlanPage from "./pages/ProductionPlanPage";
import SalesReportPage from "./pages/SalesReportPage";
import SubscriptionChargesPage from "./pages/SubscriptionChargesPage";
import SubscriptionDetailsPage from "./pages/SubscriptionDetailsPage";
import SubscriptionsPage from "./pages/SubscriptionsPage";
import UsersPage from "./pages/UsersPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={<LoginPage />}
        />

        <Route
          element={
            <ProtectedRoute
              allowedRoles={[
                "admin",
              ]}
            />
          }
        >
          <Route
            element={
              <AdminLayout />
            }
          >
            <Route
              index
              element={
                <Navigate
                  to="/dashboard"
                  replace
                />
              }
            />

            <Route
              path="/dashboard"
              element={
                <DashboardPage />
              }
            />

            <Route
              path="/products"
              element={
                <ProductsPage />
              }
            />

            <Route
              path="/orders"
              element={
                <OrdersPage />
              }
            />

            <Route
              path="/invoices"
              element={
                <InvoicePrintPage />
              }
            />

            <Route
              path="/operations"
              element={
                <OperationsPage />
              }
            />

            <Route
              path="/follow-ups"
              element={
                <FollowUpsPage />
              }
            />

            <Route
              path="/sales-report"
              element={
                <SalesReportPage />
              }
            />

            <Route
              path="/costing"
              element={
                <CostingPage />
              }
            />

            <Route
              path="/production-plan"
              element={
                <ProductionPlanPage />
              }
            />

            <Route
              path="/batch-register"
              element={
                <BatchRegisterPage />
              }
            />

            <Route
              path="/batch-labels"
              element={
                <BatchLabelsPage />
              }
            />

            <Route
              path="/delivery-partners"
              element={
                <DeliveryPartnersPage />
              }
            />

            <Route
              path="/delivery-slots"
              element={
                <DeliverySlotsPage />
              }
            />

            <Route
              path="/reviews"
              element={
                <DeliveryReviewsPage />
              }
            />

            <Route
              path="/coupons"
              element={
                <CouponsPage />
              }
            />

            <Route
              path="/locations"
              element={
                <LocationsPage />
              }
            />

            <Route
              path="/plans"
              element={
                <PlansPage />
              }
            />

            <Route
              path="/subscriptions"
              element={
                <SubscriptionsPage />
              }
            />

            <Route
              path="/subscriptions/:subscriptionId"
              element={
                <SubscriptionDetailsPage />
              }
            />

            <Route
              path="/subscription-charges"
              element={
                <SubscriptionChargesPage />
              }
            />

            <Route
              path="/users"
              element={
                <UsersPage />
              }
            />
          </Route>
        </Route>

        <Route
          element={
            <ProtectedRoute
              allowedRoles={[
                "delivery",
              ]}
            />
          }
        >
          <Route
            element={
              <DeliveryLayout />
            }
          >
            <Route
              index
              element={
                <Navigate
                  to="/delivery"
                  replace
                />
              }
            />

            <Route
              path="/delivery"
              element={
                <DeliveryDashboardPage />
              }
            />
          </Route>
        </Route>

        <Route
          path="/"
          element={
            <Navigate
              to="/login"
              replace
            />
          }
        />

        <Route
          path="*"
          element={
            <Navigate
              to="/login"
              replace
            />
          }
        />
      </Routes>
    </BrowserRouter>
  );
}