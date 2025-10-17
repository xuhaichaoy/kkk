import { createFileRoute } from '@tanstack/react-router';
import Layout from '../../components/Layout';
import TodoCalendarPage from '../../pages/TodoCalendarPage';
import React from 'react';

export const Route = createFileRoute('/calendar/')({
  component: () => (
    <Layout>
      <TodoCalendarPage />
    </Layout>
  ),
});
