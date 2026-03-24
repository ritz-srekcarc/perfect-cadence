import { AutoModel, AutoTokenizer, env } from '@huggingface/transformers';

env.localModelPath = './public/models/';
env.cacheDir = './public/models/';

async function download() {
  console.log('Downloading Kokoro models...');
  const model_id = 'onnx-community/Kokoro-82M-v1.0-ONNX';
  await AutoTokenizer.from_pretrained(model_id);
  await AutoModel.from_pretrained(model_id, { dtype: 'fp32' });
  console.log('Done.');
}
download();
