import express from 'express';
import { saveCall, getRules, createAlerts, createRule, getAlerts, updateRule, toggleRule } from './database.js';

const idempotencyStore = {};

const PORT = process.env.PORT || 3000;
const app = express();
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'server is up and running!' 
  });
});

app.post('/calls', (req, res) => {
  const { timestamp, phone, location, transcript } = req.body;
  const idempotencyKey = req.headers['idempotency-key'];

  if (idempotencyKey && idempotencyStore[idempotencyKey]) {
    console.log(`Duplicate request detected for key: ${idempotencyKey}`);
    return res.status(200).json(idempotencyStore[idempotencyKey]);
  }

  if (!timestamp || !phone || !location || !transcript) {
    return res.status(400).json({ error: 'Missing required call fields' });
  }

  try {
    const call = saveCall({ timestamp, phone, location, transcript });

    const enabledRules = getRules(true);
    const matchesFound = [];

    for (const rule of enabledRules) {
      const matchedKeywords = rule.keywords.filter(kw => 
        transcript.toLowerCase().includes(kw.toLowerCase())
      );

      if (matchedKeywords.length > 0) {
        matchesFound.push({
          ruleId: rule.id,
          callId: call.id,
          matchedKeywords
        });
      }
    }

    let alerts = [];
    if (matchesFound.length > 0) {
      alerts = createAlerts(matchesFound);
    }

    const result = { call, alerts };

    if (idempotencyKey) {
      idempotencyStore[idempotencyKey] = result;
    }

    return res.status(201).json(result);

  } catch (error) {
    console.error('Failed to process call:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/rules', (req, res) => {
  const { name, keywords, enabled } = req.body;

  if (!name || !Array.isArray(keywords) || keywords.length === 0) {
    return res.status(400).json({ error: 'Missing required rules fields' });
  }

  try {
    const hasInvalidKeyword = keywords.some(keyword => {
      if (typeof keyword !== 'string') {
        return true;
      }
      return keyword.trim() === '';
    });

    if (hasInvalidKeyword) {
      return res
        .status(400)
        .json({ error: 'Keywords cannot be empty and must be strings' });
    }

    const rule = createRule({ name, keywords, enabled });

    return res.status(201).json(rule);

  } catch (error) {
    console.error('Failed to process rule:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/rules', (req, res) => {
  try {

    const onlyEnabled = req.query.enabled === 'true';
    const rules = getRules(onlyEnabled);

    return res.status(200).json(rules);
  } catch (error) {
    console.error('Error fetching rules:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/alerts', (req, res) => {
  try {

    const { ruleId, callId } = req.query;
    const alerts = getAlerts(ruleId, callId);

    return res.status(200).json(alerts);
  } catch (error) {
    console.error('Error fetching alerts:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.patch('/rules/:id', (req, res) => {
  const { id } = req.params;
  const updates = req.body;
    
  const hasUpdates = Object.keys(updates).length > 0;

  if (!hasUpdates) {
    return res.status(400).json({ error: 'No update fields provided' });
  }

  try {
    const updatedRule = updateRule(id, updates);

    if (!updatedRule) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    return res.status(200).json(updatedRule);
  } catch (error) {
    console.error('Failed to update rule:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/rules/:id/toggle', (req, res) => {
  const { id } = req.params;

  try {
    const updatedRule = toggleRule(id);

    if (!updatedRule) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    return res.status(200).json({
      message: `Rule is now ${updatedRule.enabled ? 'enabled' : 'disabled'}`,
      rule: updatedRule
    });
  } catch (error) {
    console.error('Failed to toggle rule:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export { app, server };