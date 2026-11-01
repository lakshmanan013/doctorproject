import { Routes, Route } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

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
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      {/* -------------------- 1. DOMAIN ROOT: DOCTOR LOGIN PAGE -------------------- */}
      {/* Entering the domain name directly opens Doctor Login (or Dashboard if already authenticated) */}
      <Route
        path="/"
        element={
          isAuthenticated ? (
            <DashboardLayout>
              <Dashboard />
            </DashboardLayout>
          ) : (
            <PublicRoute>
              <Login />
            </PublicRoute>
          )
        }
      />

      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />

      {/* -------------------- 2. DOMAIN /crm: ADMIN CRM LOGIN PAGE -------------------- */}
      {/* Entering the domain name near slash crm (/crm) directly opens Admin CRM Login */}
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

      {/* -------------------- PROTECTED DOCTOR DASHBOARD ROUTES -------------------- */}
      <Route
        element={
          <PrivateRoute>
            <DashboardLayout />
          </PrivateRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/appointments" element={<AppointmentPage />} />
        <Route path="/video-consultation" element={<VideoConsultation />} />
        <Route path="/video-consultant" element={<VideoConsultation />} />
        <Route path="/patients" element={<Patients />} />
        <Route path="/patients/:id" element={<PatientProfile />} />
        <Route path="/prescriptions" element={<Prescription />} />
        <Route path="/followups" element={<Followup />} />
        <Route path="/vaccinations" element={<Vaccination />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/equips" element={<Equips />} />
        <Route path="/billing" element={<Billing />} />
        <Route path="/settings" element={<DoctorProfile />} />
      </Route>

      {/* -------------------- 3. OTHER THAN THAT: NO OTHER URL OR PATH CAN COME -------------------- */}
      {/* Any arbitrary, unknown, or unauthorized URL strictly bounces to Doctor Login at "/" */}
      <Route path="*" element={<InvalidRouteRedirect />} />
    </Routes>
  );
}

export default AppRoutes;
