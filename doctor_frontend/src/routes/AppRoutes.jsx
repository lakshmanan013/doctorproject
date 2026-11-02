import { Routes, Route } from "react-router-dom";

import DashboardLayout from "../layouts/DashboardLayout";
import PrivateRoute from "./PrivateRoute";
import PublicRoute from "./PublicRoute";
import CrmRedirect from "./CrmRedirect";
import InvalidRouteRedirect from "./InvalidRouteRedirect";

import Login from "../pages/Auth/Login";
import Register from "../pages/Auth/Register";
import ForgotPassword from "../pages/Auth/ForgotPassword";
import ResetPassword from "../pages/Auth/ResetPassword";
import OtpVerificationPage from "../pages/Auth/OtpVerificationPage";

import Dashboard from "../pages/Dashboard/Dashboard";
import AppointmentPage from "../pages/Appointments/AppointmentPage";
import Patients from "../pages/Patients/Patients";
import PatientProfile from "../pages/Patients/PatientProfile";
import Prescription from "../pages/Prescription/Prescription";
import Followup from "../pages/Followups/Followup";
import Vaccination from "../pages/Vaccinations/Vaccination";
import Inventory from "../pages/Inventory/Inventory";
import Equips from "../pages/Equips/Equips";
import Billing from "../pages/Billing/Billing";
import DoctorProfile from "../pages/Settings/DoctorProfile";
import VideoConsultation from "../pages/VideoConsultation/VideoConsultation";

import PetParentRoom from "../pages/VideoConsultation/PetParentRoom";

function AppRoutes() {
  return (
    <Routes>
      {/* -------------------- 1. ADMIN CRM LOGIN (/crm) -------------------- */}
      {/* Entering near slash crm (/crm) directly opens Admin CRM Login */}
      <Route path="/crm" element={<CrmRedirect />} />
      <Route path="/crm/*" element={<CrmRedirect />} />
      <Route path="/admin" element={<CrmRedirect />} />
      <Route path="/admin/*" element={<CrmRedirect />} />

      {/* -------------------- AUTH REGISTRATION & RECOVERY -------------------- */}
      <Route
        path="/register"
        element={
          <PublicRoute>
            <Register />
          </PublicRoute>
        }
      />

      <Route
        path="/forgot-password"
        element={
          <PublicRoute>
            <ForgotPassword />
          </PublicRoute>
        }
      />

      <Route
        path="/reset-password"
        element={
          <PublicRoute>
            <ResetPassword />
          </PublicRoute>
        }
      />

      <Route
        path="/verify-otp"
        element={
          <PublicRoute>
            <OtpVerificationPage />
          </PublicRoute>
        }
      />

      <Route
        path="/otp-verification"
        element={
          <PublicRoute>
            <OtpVerificationPage />
          </PublicRoute>
        }
      />

      {/* -------------------- PUBLIC TELEHEALTH ROOM (PET PARENT ACCESS) -------------------- */}
      <Route path="/join-call/:roomCode" element={<PetParentRoom />} />
      <Route path="/telehealth/:roomCode" element={<PetParentRoom />} />

      {/* -------------------- 2. ROOT & PROTECTED DOCTOR DASHBOARD ROUTES -------------------- */}
      {/* When unauthenticated: PrivateRoute renders Doctor Login directly at "/" */}
      {/* When authenticated: PrivateRoute renders DashboardLayout, and Outlet renders Dashboard at "/" */}
      <Route
        path="/"
        element={
          <PrivateRoute>
            <DashboardLayout />
          </PrivateRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="appointments" element={<AppointmentPage />} />
        <Route path="video-consultation" element={<VideoConsultation />} />
        <Route path="video-consultant" element={<VideoConsultation />} />
        <Route path="patients" element={<Patients />} />
        <Route path="patients/:id" element={<PatientProfile />} />
        <Route path="prescriptions" element={<Prescription />} />
        <Route path="followups" element={<Followup />} />
        <Route path="vaccinations" element={<Vaccination />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="equips" element={<Equips />} />
        <Route path="billing" element={<Billing />} />
        <Route path="settings" element={<DoctorProfile />} />
      </Route>

      {/* Direct /login route for compatibility */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />

      {/* -------------------- 3. STRICT SHIELD: OTHER THAN THAT NO URL OR PATH CAN COME -------------------- */}
      {/* Any arbitrary, unknown, or unauthorized URL strictly bounces to Doctor Login at "/" */}
      <Route path="*" element={<InvalidRouteRedirect />} />
    </Routes>
  );
}

export default AppRoutes;
