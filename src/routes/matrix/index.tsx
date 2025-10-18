import { createFileRoute } from '@tanstack/react-router';
import Layout from '../../components/Layout';
import TodoMatrixPage from '../../pages/TodoMatrixPage';
import React from 'react';

export const Route = createFileRoute('/matrix/')({
  component: () => (
    <Layout>
      <TodoMatrixPage />
    </Layout>
  ),
});
