const axios = require('axios');
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bodyParser = require('body-parser');
const PDFDocument = require('pdfkit');

const app = express();
const port = process.env.PORT

app.use(cors());
app.use(bodyParser.json());
app.use((req, res, next) => {
  console.log(`Request made to: ${req.url}`);
  next();
});
require("dotenv").config();

const pool= new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});



async function categorizeExpense(description) {
  try {
    const response = await axios.post('https://apiservice-qzuu.onrender.com/categorize', { description });
    return response.data.category || 'Other';
  } catch (err) {
    console.error('Error calling ML categorizer:', err);
    return 'Other';
  }
}


app.get('/api/groups/:groupId/expenses/pdf', async (req, res) => {
  const groupId = req.params.groupId;
  try {
    const query = `
      SELECT e.*, p.name as payer_name
      FROM expenses e
      LEFT JOIN participant p ON e.payer_id = p.id
      WHERE e.group_id = $1
    `;
    const result = await pool.query(query, [groupId]);
    const expenses = result.rows;

    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=expenses.pdf');

    doc.pipe(res);

    doc.fontSize(18).text('Expense Report', { align: 'center' });
    doc.moveDown();

    let totalAmount = 0;

    expenses.forEach((expense, i) => {
      const description = expense.description || 'No description';
      const amount = Number(expense.amount);
      if (isNaN(amount)) {
        console.warn(`Skipping expense with invalid amount: ${expense.amount}`);
        return;
      }
      totalAmount += amount;

      const payerName = expense.payer_name || 'Unknown payer';

      doc.fontSize(12).text(`${i + 1}. ${description} — Rs.${amount.toFixed(2)} (Paid by: ${payerName})`);
    });

    doc.moveDown();
    doc.fontSize(14).text(`Total Expense: Rs.${totalAmount.toFixed(2)}`, { align: 'right' });

    doc.end();
  } catch (err) {
    console.error('Error generating PDF:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate PDF' });
    }
  }
});

// Delete participant
app.delete('/api/participant/:id', async (req, res) => {
  const participantId = parseInt(req.params.id);
  try {
    const result = await pool.query('DELETE FROM participant WHERE id = $1 RETURNING *', [participantId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Participant not found' });
    }
    res.json({ message: 'Participant deleted successfully', deleted: result.rows[0] });
  } catch (err) {
    console.error('Error deleting participant:', err);
    res.status(500).json({ error: 'Failed to delete participant' });
  }
});



app.get('/api/groups/:groupId/expenses', async (req, res) => {
  const groupId = req.params.groupId;
  try {
    const result = await pool.query('SELECT * FROM expenses WHERE group_id = $1', [groupId]);
    res.json({ expenses: result.rows });
  } catch (error) {
    console.error('Error fetching expenses:', error);
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
});

app.post('/api/expenses', async (req, res) => {
  const { group_id, amount, description, payer_id } = req.body;
  const category = await categorizeExpense(description);

  try {
    const result = await pool.query(
      'INSERT INTO expenses (group_id, amount, description, payer_id, category, created_at) VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *',
      [group_id, amount, description, payer_id, category]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add expense' });
  }
});


app.post('/api/createGroup', async (req, res) => {
  const { group_name, key } = req.body;
  if (!group_name || !key) {
    return res.status(400).json({ error: 'Group name and key are required' });
  }

  try {
    // Case‑insensitive check for existing group
    const existing = await pool.query(
      `SELECT id FROM groups WHERE LOWER(group_name) = LOWER($1)`,
      [group_name.trim()]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Group name already exists' });
    }

    // Insert new group
    const result = await pool.query(
      `INSERT INTO groups (group_name, key) VALUES ($1, $2) RETURNING id`,
      [group_name.trim(), key]
    );
    res.status(201).json({ group_id: result.rows[0].id });
  } catch (err) {
    console.error('Error creating group:', err);
    res.status(500).json({ error: 'Database error' });
  }
});


app.post('/api/participant', async (req, res) => {
  const { group_id, name } = req.body;
  if (!group_id || !name) {
    return res.status(400).json({ error: 'group_id and name are required' });
  }

  try {
    // Check if participant with the same name (case-insensitive) exists in the group
    const existing = await pool.query(
      `SELECT * FROM participant WHERE group_id = $1 AND LOWER(name) = LOWER($2)`,
      [group_id, name.trim()]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Participant with this name already exists' });
    }

    // Insert new participant
    const result = await pool.query(
      `INSERT INTO participant (group_id, name) VALUES ($1, $2) RETURNING *`,
      [group_id, name.trim()]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add participant' });
  }
});


app.get('/api/groups', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM groups');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching groups:', err);
    res.status(500).json({ error: 'Failed to fetch groups' });
  }
});

app.get('/test', (req, res) => {
  res.send('Test route is working!');
});

app.get('/api/groups/:groupId/participant', async (req, res) => {
  const groupId = req.params.groupId;
  if (!groupId) return res.status(400).json({ error: 'Group ID is required' });
  try {
    const result = await pool.query('SELECT * FROM participant WHERE group_id = $1', [groupId]);
    res.json({ participants: result.rows });
  } catch (error) {
    console.error('Error fetching participants:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/login', async (req, res) => {
  const { group_name, key } = req.body;
  try {
    const groupRes = await pool.query('SELECT id, key FROM groups WHERE group_name = $1', [group_name]);
    if (groupRes.rows.length === 0) {
      return res.status(400).json({ error: 'Group not found' });
    }
    const group = groupRes.rows[0];
    if (group.key !== key) {
      return res.status(400).json({ error: 'Invalid key' });
    }
    const participantRes = await pool.query('SELECT * FROM participant WHERE group_id = $1', [group.id]);
    const participant = participantRes.rows.length > 0 ? participantRes.rows : [];
    res.json({
      success: true,
      group_id: group.id,
      group_name: group_name,
      participant: participant,
    });
  } catch (err) {
    console.error('Error during login:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/payments', async (req, res) => {
  const { expense_id, payer_id, payee_id, amount, group_id } = req.body;
  if (!expense_id || !payer_id || !payee_id || !amount || !group_id) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    await pool.query(
      `INSERT INTO payments (expense_id, payer_id, payee_id, amount, group_id) VALUES ($1, $2, $3, $4, $5)`,
      [expense_id, payer_id, payee_id, amount, group_id]
    );
    res.status(201).json({ message: 'Payment recorded successfully' });
  } catch (err) {
    console.error('Error recording payment:', err);
    res.status(500).json({ error: 'Failed to record payment' });
  }
});


app.get('/api/groups/:groupId/payments', async (req, res) => {
  const groupId = req.params.groupId;
  try {
    const result = await pool.query(
      'SELECT * FROM payments WHERE group_id = $1',
      [groupId]
    );
    res.json({ payments: result.rows });
  } catch (err) {
    console.error('Error fetching payments:', err);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

app.delete('/api/expenses/:id', async (req, res) => {
  const expenseId = parseInt(req.params.id);
  try {
    const result = await pool.query('DELETE FROM expenses WHERE id = $1 RETURNING *', [expenseId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }
    res.json({ message: 'Expense deleted successfully', deleted: result.rows[0] });
  } catch (err) {
    console.error('Error deleting expense:', err);
    res.status(500).json({ error: 'Failed to delete expense' });
  }
});




app.post('/api/test-webhook', (req, res) => {
  console.log('\nTEST ENDPOINT ANALYSIS:');
  console.log('Parsed body:', req.body);
  console.log('Raw body:', req.rawBody);
  console.log('Headers:', req.headers);

  res.json({
    parsedBody: req.body,
    rawBody: req.rawBody,
    headers: req.headers
  });
});




app.post('/api/chatbot', async (req, res) => {
  try {
    console.log(" Full Dialogflow Request:", JSON.stringify(req.body, null, 2));

    const intent = req.body.queryResult?.intent?.displayName;
    console.log(" Intent:", intent);
    const payload = req.body.originalDetectIntentRequest?.payload || {};
    const groupId = payload.userId || payload.user?.id || req.body.session?.split('/')?.pop();

    console.log(" Extracted groupId:", groupId);
    console.log("Full payload object:", payload);

    if (!groupId) {
      console.error(" Missing groupId in payload. Full payload:", payload);
      return res.json({
        fulfillmentText: "Session error. Please refresh the page and try again.",
      });
    }

    if (intent === 'Add Expense') {
      const parameters = req.body.queryResult?.parameters || {};
      const payerName = parameters.Payer?.name || parameters.Payer;
      const amount = parameters.Amount;
      const description = parameters.Category;
      const category = await categorizeExpense(description);

      console.log(` Add Expense -> payerName=${payerName}, amount=${amount}, description=${description}`);

      if (!payerName || !amount || !description || !groupId) {
        return res.json({
          fulfillmentText: "Missing required information. Please provide payer, amount, and category."
        });
      }

      // Check if payer exists
      const payerResult = await pool.query(
        'SELECT id FROM participant WHERE LOWER(name) = LOWER($1) AND group_id = $2',
        [payerName, groupId]
      );

      if (payerResult.rows.length === 0) {
        return res.json({
          fulfillmentText: ` Participant "${payerName}" not found in group.`
        });
      }

      const payerId = payerResult.rows[0].id;


      try {
        await pool.query(
          'INSERT INTO expenses (amount, description, payer_id, group_id, category) VALUES ($1, $2, $3, $4, $5)',
          [amount, description, payerId, groupId, category]
        );
      } catch (err) {
        console.error('Error inserting expense:', err);
        throw err; // re-throw after logging
      }


      return res.json({
        fulfillmentText: ` Added ₹${amount} for "${description}" paid by ${payerName}.`
      });

    }

    //add participants

    if (intent === 'Add Participants') {
      console.log("🔍 Add Participants -> groupId:", groupId);

      const contexts = req.body.queryResult?.outputContexts || [];

      const isFollowUp = contexts.some(ctx =>
        ctx.name.includes('awaiting_participant_name')
      );

      const parameters = req.body.queryResult?.parameters || {};
      const queryText = req.body.queryResult?.queryText || '';

      let participantName;

      if (isFollowUp) {

        participantName = parameters.person?.name ||
          parameters.person ||
          parameters.name ||
          queryText;
      } else {

        participantName = parameters.person?.name ||
          parameters.person ||
          parameters.name;
      }

      if (!participantName) {
        console.log("No participant name found - prompting user");
        return res.json({
          fulfillmentText: "Please tell me the name of the participant.",
          outputContexts: [{
            name: `${req.body.session}/contexts/awaiting_participant_name`,
            lifespanCount: 1
          }]
        });
      }

      participantName = participantName.toString().trim();
      if (participantName.length === 0 || participantName.toLowerCase() === "null") {
        return res.json({
          fulfillmentText: "Please provide a valid name."
        });
      }

      console.log("Processing participant:", participantName);

      try {
        const existing = await pool.query(
          'SELECT * FROM participant WHERE group_id = $1 AND LOWER(name) = LOWER($2)',
          [groupId, participantName]
        );

        if (existing.rows.length > 0) {
          return res.json({
            fulfillmentText: `${participantName} is already in the group.`
          });
        }

        await pool.query(
          'INSERT INTO participant (group_id, name) VALUES ($1, $2)',
          [groupId, participantName]
        );

        const outputContexts = contexts.filter(ctx =>
          !ctx.name.includes('awaiting_participant_name')
        );

        return res.json({
          fulfillmentText: `Successfully added ${participantName} to the group!`,
          outputContexts: outputContexts
        });

      } catch (error) {
        console.error('Database error:', error);
        return res.json({
          fulfillmentText: "Sorry, I couldn't add the participant due to a server error."
        });
      }
    }

    //participants

    //show list
    if (intent === 'Show Participants') {
      console.log("🔄 Handling 'Show Participants' intent...");
      console.log("🔍 Show Participants -> groupId:", groupId);


      try {
        const result = await pool.query(
          'SELECT name FROM participant WHERE group_id = $1',
          [groupId]
        );

        if (result.rows.length === 0) {
          return res.json({
            fulfillmentText: 'There are no participants in this group yet.',
          });
        }

        const participantNames = result.rows.map(row => `• ${row.name}`).join('\n');
        return res.json({
          fulfillmentText: ` Participants in this group:\n${participantNames}`,
        });

      } catch (err) {
        console.error('Database error:', err);
        return res.json({
          fulfillmentText: 'Failed to fetch participants. Please try again later.',
        });
      }
    }

    if (intent === 'Get Person Balance') {
      const parameters = req.body.queryResult?.parameters || {};
      const personName = parameters.person?.name || parameters.person;

      if (!personName) {
        return res.json({
          fulfillmentText: "Please specify which person's balance you want to check."
        });
      }

      try {
        // First get the participant ID
        const participantRes = await pool.query(
          'SELECT id FROM participant WHERE LOWER(name) = LOWER($1) AND group_id = $2',
          [personName, groupId]
        );

        if (participantRes.rows.length === 0) {
          return res.json({
            fulfillmentText: `Couldn't find "${personName}" in this group.`
          });
        }

        const participantId = participantRes.rows[0].id;

        // Get balance data
        const result = await pool.query(`
            WITH splits AS (
                SELECT
                    e.id AS expense_id,
                    e.payer_id,
                    p.id AS payee_id,
                    (e.amount / cnt.participant_count) AS share
                FROM expenses e
                JOIN participant p ON p.group_id = e.group_id
                JOIN (
                    SELECT group_id, COUNT(*) AS participant_count
                    FROM participant
                    WHERE group_id = $1
                    GROUP BY group_id
                ) cnt ON cnt.group_id = e.group_id
                WHERE e.group_id = $1
            ),
            payments_made AS (
                SELECT
                    expense_id, payer_id, payee_id,
                    SUM(amount) AS paid_amount
                FROM payments
                WHERE group_id = $1
                GROUP BY expense_id, payer_id, payee_id
            ),
            balances AS (
                SELECT
                    splits.payer_id,
                    splits.payee_id,
                    splits.share - COALESCE(pm.paid_amount, 0) AS amount_owed
                FROM splits
                LEFT JOIN payments_made pm
                    ON pm.expense_id = splits.expense_id
                    AND pm.payer_id = splits.payer_id
                    AND pm.payee_id = splits.payee_id
            )
            SELECT
                b.payer_id, payer.name AS payer_name,
                b.payee_id, payee.name AS payee_name,
                ROUND(SUM(amount_owed), 2) AS total_owed
            FROM balances b
            JOIN participant payer ON b.payer_id = payer.id AND payer.group_id = $1
            JOIN participant payee ON b.payee_id = payee.id AND payee.group_id = $1
            WHERE (b.payer_id = $2 OR b.payee_id = $2)
                AND ABS(amount_owed) > 0.0099
                AND b.payer_id != b.payee_id
            GROUP BY b.payer_id, payer.name, b.payee_id, payee.name
            HAVING ABS(SUM(amount_owed)) > 0.0099
        `, [groupId, participantId]);

        if (result.rows.length === 0) {
          return res.json({
            fulfillmentText: `${personName} is all settled up with everyone.`
          });
        }

        // Format the response with clear separators
        const owes = [];
        const owed = [];

        result.rows.forEach(row => {
          if (row.payee_id === participantId) {
            owes.push(`₹${row.total_owed} to ${row.payer_name}`);
          } else {
            owed.push(`${row.payee_name} owes ₹${row.total_owed}`);
          }
        });

        let responseText = ` *Balance for ${personName}* \n\n`;

        if (owed.length > 0) {
          responseText += `🔹 *${personName} is owed:*\n${owed.join('\n')}\n\n`;
        } else {
          responseText += `🔹 *${personName} is not owed any money*\n\n`;
        }

        if (owes.length > 0) {
          responseText += `🔸 *${personName} owes:*\n${owes.join('\n')}`;
        } else {
          responseText += `🔸 *${personName} doesn't owe anyone*`;
        }

        // Add separator line if both sections exist
        if (owed.length > 0 && owes.length > 0) {
          responseText = ` *Balance for ${personName}* \n\n` +
            `🔹 *${personName} is owed:*\n${owed.join('\n')}\n` +
            `────────────────────\n` +
            `🔸 *${personName} owes:*\n${owes.join('\n')}`;
        }

        return res.json({
          fulfillmentText: responseText
        });

      } catch (error) {
        console.error('Error getting person balance:', error);
        return res.json({
          fulfillmentText: `Sorry, I couldn't get the balance for ${personName}. Please try again later.`
        });
      }
    }

    if (intent === 'Get Balance') {
      console.log("💰 Handling 'Get Balance' intent...");
      console.log("🔍 groupId:", groupId);

      try {
        const result = await pool.query(`
      WITH splits AS (
        SELECT
          e.id AS expense_id,
          e.payer_id,
          p.id AS payee_id,
          (e.amount / cnt.participant_count) AS share
        FROM expenses e
        JOIN participant p ON p.group_id = e.group_id
        JOIN (
          SELECT group_id, COUNT(*) AS participant_count
          FROM participant
          WHERE group_id = $1
          GROUP BY group_id
        ) cnt ON cnt.group_id = e.group_id
        WHERE e.group_id = $1
      ),
      payments_made AS (
        SELECT
          expense_id, payer_id, payee_id,
          SUM(amount) AS paid_amount
        FROM payments
        WHERE group_id = $1
        GROUP BY expense_id, payer_id, payee_id
      ),
      balances AS (
        SELECT
          splits.payer_id,
          splits.payee_id,
          splits.share - COALESCE(pm.paid_amount, 0) AS amount_owed
        FROM splits
        LEFT JOIN payments_made pm
          ON pm.expense_id = splits.expense_id
         AND pm.payer_id = splits.payer_id
         AND pm.payee_id = splits.payee_id
      )
      SELECT
        b.payer_id, payer.name AS payer_name,
        b.payee_id, payee.name AS payee_name,
        ROUND(SUM(amount_owed), 2) AS total_owed
      FROM balances b
      JOIN participant payer ON b.payer_id = payer.id AND payer.group_id = $1
      JOIN participant payee ON b.payee_id = payee.id AND payee.group_id = $1
      WHERE ABS(amount_owed) > 0.0099  -- More precise float comparison
        AND b.payer_id != b.payee_id
      GROUP BY b.payer_id, payer.name, b.payee_id, payee.name
      HAVING ABS(SUM(amount_owed)) > 0.0099
    `, [groupId]);

        if (result.rows.length === 0) {
          return res.json({
            fulfillmentText: 'Everyone is settled up. No balances remain.'
          });
        }
        const lines = result.rows.map(row =>
          `${row.payee_name} owes ₹${row.total_owed} to ${row.payer_name}`
        ).join('<br>');

        return res.json({
          fulfillmentMessages: [
            {
              text: {
                text: [
                  "Here's the current balance sheet:",
                  ...result.rows.map(row => `${row.payee_name} owes ₹${row.total_owed} to ${row.payer_name}`)
                ]
              }
            }
          ]
        });




      } catch (err) {
        console.error('Error fetching balances:', err);
        return res.json({
          fulfillmentText: `Sorry, I couldn't retrieve the balances right now. Please try again later.`
        });
      }
    }

    if (intent === 'Today Expenses' || intent === 'Get Expenses By Date') {
    const parameters = req.body.queryResult?.parameters || {};
    let targetDate = parameters.date;

    try {
        // Default to today if no date
        if (!targetDate) {
            targetDate = new Date().toISOString().split('T')[0];
        } 
        // Extract YYYY-MM-DD if timestamp exists
        else {
            targetDate = targetDate.split('T')[0];
            const dateObj = new Date(targetDate);
            const currentYear = new Date().getFullYear();

            // If year is not specified (e.g., "May 22"), default to current year
            if (dateObj.getFullYear() !== currentYear) {
                dateObj.setFullYear(currentYear);
                targetDate = dateObj.toISOString().split('T')[0];
            }
        }

        console.log(`Fetching expenses for: ${targetDate}`);

        const result = await pool.query(
            `SELECT amount, description, category 
             FROM expenses 
             WHERE group_id = $1 AND DATE(created_at) = $2`,
            [groupId, targetDate]
        );

        if (result.rows.length === 0) {
            return res.json({
                fulfillmentText: `No expenses found for ${targetDate}.`
            });
        }

        let total = 0;
        const expenseLines = result.rows.map(exp => {
            total += Number(exp.amount);
            return `• ₹${exp.amount} - ${exp.description} (${exp.category})`;
        }).join('\n');

        return res.json({
            fulfillmentText: `Expenses for ${targetDate}:\n${expenseLines}\nTotal: ₹${total}`
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            fulfillmentText: "Error fetching expenses. Please try again."
        });
    }
}

if (intent === 'Get Expenses By Category') {
  const parameters = req.body.queryResult?.parameters || {};
  const category = parameters.category?.toLowerCase();

  if (!category) {
    return res.json({
      fulfillmentText: 'Please specify a category like food, travel, or groceries.'
    });
  }

  console.log(`Fetching expenses for category: ${category}`);

  try {
    const result = await pool.query(
      `SELECT amount, description, created_at 
       FROM expenses 
       WHERE group_id = $1 AND LOWER(category) = $2`,
      [groupId, category]
    );

    if (result.rows.length === 0) {
      return res.json({
        fulfillmentText: `No expenses found in the "${category}" category.`
      });
    }

    let total = 0;
    const expenseLines = result.rows.map(exp => {
      total += Number(exp.amount);
      const date = new Date(exp.created_at).toISOString().split('T')[0];
      return `• ₹${exp.amount} - ${exp.description} (on ${date})`;
    }).join('\n');

    return res.json({
      fulfillmentText: `Here are your "${category}" expenses:\n${expenseLines}\n\nTotal: ₹${total}`
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      fulfillmentText: 'Error while fetching category expenses.'
    });
  }
}


if (intent === 'Most_spent_category') {
  try {
    console.log("Running most_spent_category query for groupId:", groupId);

    const categoryRes = await pool.query(
      'SELECT category, SUM(amount) as total FROM expenses WHERE group_id = $1 GROUP BY category ORDER BY total DESC LIMIT 1',
      [groupId]
    );

    console.log(" Query result:", categoryRes.rows);

    if (categoryRes.rows.length === 0) {
      return res.json({
        fulfillmentText: 'No expense data found for this group.'
      });
    }

    const topCategory = categoryRes.rows[0].category;
    return res.json({
      fulfillmentText: `The category you spent the most on is: ${topCategory}`
    });

  } catch (error) {
    console.error(" Error in Most_spent_category intent:", error);
    return res.json({
      fulfillmentText: 'An error occurred while fetching the most spent category.'
    });
  }
}


if (intent === 'Get Monthly Expenses') {
    const parameters = req.body.queryResult?.parameters || {};
    let monthYear = parameters['date-period'] || parameters['date'] || parameters['month'];

    try {
        // Parse month and year from different possible formats
        let month, year;
        const currentDate = new Date();
        
        if (!monthYear) {
            // Default to current month if no date specified
            month = currentDate.getMonth() + 1;
            year = currentDate.getFullYear();
        } else if (typeof monthYear === 'string' && monthYear.includes('/')) {
            // Handle "MM/YYYY" format
            [month, year] = monthYear.split('/').map(Number);
        } else if (monthYear.startDate) {
            // Handle date-period object from Dialogflow
            const startDate = new Date(monthYear.startDate);
            month = startDate.getMonth() + 1;
            year = startDate.getFullYear();
        } else {
            // Handle other date formats
            const dateObj = new Date(monthYear);
            month = dateObj.getMonth() + 1;
            year = dateObj.getFullYear();
        }

        // Validate month and year
        if (isNaN(month) || isNaN(year) || month < 1 || month > 12) {
            return res.json({
                fulfillmentText: "Please specify a valid month and year (e.g., 'May 2023' or '05/2023')."
            });
        }

        const monthNames = ["January", "February", "March", "April", "May", "June",
                          "July", "August", "September", "October", "November", "December"];
        const monthName = monthNames[month - 1];

        console.log(`Fetching expenses for ${monthName} ${year}`);

        // Get first and last day of month
        const firstDay = new Date(year, month - 1, 1);
        const lastDay = new Date(year, month, 0);

        const result = await pool.query(
            `SELECT e.amount, e.description, e.category, e.created_at, p.name as payer_name
             FROM expenses e
             JOIN participant p ON e.payer_id = p.id
             WHERE e.group_id = $1 
             AND e.created_at BETWEEN $2 AND $3
             ORDER BY e.created_at DESC`,
            [groupId, firstDay, lastDay]
        );

        if (result.rows.length === 0) {
            return res.json({
                fulfillmentText: `No expenses found for ${monthName} ${year}.`
            });
        }

        // Organize by category
        const categories = {};
        let grandTotal = 0;

        result.rows.forEach(exp => {
            const amount = Number(exp.amount);
            grandTotal += amount;
            
            if (!categories[exp.category]) {
                categories[exp.category] = {
                    total: 0,
                    expenses: []
                };
            }
            
            categories[exp.category].total += amount;
            categories[exp.category].expenses.push({
                amount: amount,
                description: exp.description,
                payer: exp.payer_name,
                date: new Date(exp.created_at).toLocaleDateString('en-IN')
            });
        });

  
        let responseText = ` Monthly Expenses for ${monthName} ${year}\n\n`;
        
        for (const [category, data] of Object.entries(categories)) {
            responseText += ` ${category} (Total: ₹${data.total.toFixed(2)})\n`;
            
            data.expenses.forEach(exp => {
                responseText += `  • ₹${exp.amount.toFixed(2)} - ${exp.description} (Paid by ${exp.payer} on ${exp.date})\n`;
            });
            
            responseText += '\n';
        }

        responseText += `────────────────\n`;
        responseText += `Grand Total: ₹${grandTotal.toFixed(2)}`;

        return res.json({
            fulfillmentText: responseText
        });

    } catch (error) {
        console.error('Error fetching monthly expenses:', error);
        return res.json({
            fulfillmentText: "Sorry, I couldn't fetch the monthly expenses. Please try again later."
        });
    }
}


    else {
    
      return res.json({
        fulfillmentText: "I didn't understand that request. Please try again or say 'help' for available commands.",
        outputContexts: [{
          name: `${req.body.session}/contexts/fallback`,
          lifespanCount: 1
        }]
      });
    }

  } catch (error) {
    console.error(" Webhook Error:", error);
    return res.json({
      fulfillmentText: "Server error. Please try again later."
    });
  }
});












app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

app.get('/', (req, res) => res.send('Backend working!'));
