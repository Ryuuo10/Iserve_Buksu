# AI Pipeline Setup

The grievance AI pipeline in [`backend/models/iserve_ai.py`](./models/iserve_ai.py) expects local model files inside `backend/models/` plus a Python environment with the required ML packages.

## Required local model directories

These folders are read directly by `iserve_ai.py`:

- `backend/models/summarizer/`
- `backend/models/classification/` or `backend/models/classifier/`
- `backend/models/urgency/`
- `backend/models/sentiment/`

Each model folder should contain the Hugging Face export files for that model, typically:

- `config.json`
- `model.safetensors` or `pytorch_model.bin`
- tokenizer files such as `tokenizer.json`, `tokenizer_config.json`, `special_tokens_map.json`, and any vocab files required by the model

## Python requirements

Install the Python packages used by the AI worker in the same environment that the backend will use to spawn Python:

```bash
pip install torch transformers tokenizers
```

If `python` is not the correct executable on your machine, set the backend environment variable before starting the server:

```bash
AI_PIPELINE_PYTHON=python
```

Replace `python` with the exact interpreter path if needed.

## Runtime flow

1. The Node backend starts normally.
2. When a grievance is submitted, Node saves the complaint first.
3. Node then spawns the Python worker from [`backend/services/aiPipelineClient.js`](./services/aiPipelineClient.js).
4. The worker loads the local models and returns:
   - summary
   - category
   - urgency
   - sentiment
5. The grievance record is updated with `aiAnalysis` and `aiAnalysisStatus`, then the UI receives the update in real time.

## Verification

You can test the Python pipeline directly with:

```bash
python backend/models/iserve_ai.py --text "Sample grievance text here"
```

You can also evaluate the models on a labeled batch of complaint samples:

```bash
cd backend
npm run eval:ai
```

To evaluate your own dataset, copy `backend/scripts/ai_eval_samples.example.json`, replace the samples with your own labeled complaints, and run:

```bash
python backend/scripts/evaluate_ai_models.py --input path/to/your-samples.json --output ai-eval-report.json
```
