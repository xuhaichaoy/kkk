import { createFileRoute } from '@tanstack/react-router';
import Layout from '../../components/Layout';
import SpeechToTextPage from '../../pages/SpeechToTextPage';

export const Route = createFileRoute('/speech/')({
  component: () => (
    <Layout>
      <SpeechToTextPage />
    </Layout>
  ),
});
