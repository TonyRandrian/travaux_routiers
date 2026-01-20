import { createRouter, createWebHistory } from '@ionic/vue-router';
import { RouteRecordRaw } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    redirect: '/home'
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/auth/LoginPage.vue'),
    meta: { requiresGuest: true }
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('@/views/auth/RegisterPage.vue'),
    meta: { requiresGuest: true }
  },
  {
    path: '/forgot-password',
    name: 'ForgotPassword',
    component: () => import('@/views/auth/ForgotPasswordPage.vue'),
    meta: { requiresGuest: true }
  },
  {
    path: '/home',
    name: 'Home',
    component: () => import('@/views/HomePage.vue'),
    meta: { requiresAuth: false }  // Accessible sans auth
  },
  {
    path: '/map',
    name: 'Map',
    component: () => import('@/views/MapPage.vue'),
    meta: { requiresAuth: false }  // Accessible sans auth
  },
  {
    path: '/signalement/new',
    name: 'NewSignalement',
    component: () => import('@/views/NewSignalementPage.vue'),
    meta: { requiresAuth: true }  // Auth requise pour créer
  },
  {
    path: '/my-signalements',
    name: 'MySignalements',
    component: () => import('@/views/MySignalementsPage.vue'),
    meta: { requiresAuth: true }  // Auth requise pour voir ses signalements
  },
  {
    path: '/profile',
    name: 'Profile',
    component: () => import('@/views/ProfilePage.vue'),
    meta: { requiresAuth: true }  // Auth requise pour le profil
  }
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
});

// Navigation guards
router.beforeEach((to, from, next) => {
  const authStore = useAuthStore();
  const isAuthenticated = authStore.isAuthenticated;

  // Si la page requiert l'auth et l'utilisateur n'est pas connecté
  if (to.meta.requiresAuth && !isAuthenticated) {
    // Rediriger vers login avec la page de retour
    next({ path: '/login', query: { redirect: to.fullPath } });
  } 
  // Si la page est réservée aux guests et l'utilisateur est connecté
  else if (to.meta.requiresGuest && isAuthenticated) {
    next('/home');
  } 
  else {
    next();
  }
});

export default router;
