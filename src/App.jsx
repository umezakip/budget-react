import React, { useEffect, useState } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, serverTimestamp, query, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

// Global variables provided by the environment
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Main App component
const App = () => {
  // State variables
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [recurringTransactions, setRecurringTransactions] = useState([]);
  const [overallBudgetLimit, setOverallBudgetLimit] = useState(0);
  const [categoryBudgets, setCategoryBudgets] = useState({});
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [budgetPeriodType, setBudgetPeriodType] = useState('monthly');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [spendingData, setSpendingData] = useState([]);
  const [savingsGoals, setSavingsGoals] = useState([]);
  const [budgetMode, setBudgetMode] = useState('overall');
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [contributionAmount, setContributionAmount] = useState('');
  const [selectedGoalId, setSelectedGoalId] = useState('');
  const [newGoalName, setNewGoalName, ] = useState('');
  const [newGoalTarget, setNewGoalTarget] = useState('');
  const [message, setMessage] = useState({ text: '', type: '' });
  const [showModal, setShowModal] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  
  // Form state
  const [newIncomeAmount, setNewIncomeAmount] = useState('');
  const [newIncomeSource, setNewIncomeSource] = useState('');
  const [newExpenseAmount, setNewExpenseAmount] = useState('');
  const [newExpenseDescription, setNewExpenseDescription] = useState('');
  const [newExpenseCategory, setNewExpenseCategory] = useState('');
  const [newOverallBudgetLimit, setNewOverallBudgetLimit] = useState('');
  const [newCategoryBudgetAmount, setNewCategoryBudgetAmount] = useState('');
  const [newCategoryBudgetCategory, setNewCategoryBudgetCategory] = useState('');
  const [newRecurringAmount, setNewRecurringAmount] = useState('');
  const [newRecurringDescription, setNewRecurringDescription] = useState('');
  const [newRecurringFrequency, setNewRecurringFrequency] = useState('monthly');
  const [newRecurringType, setNewRecurringType] = useState('expense');
  const [newRecurringCategory, setNewRecurringCategory] = useState('');
  
  const expenseCategories = ['Housing', 'Transportation', 'Food', 'Utilities', 'Personal', 'Entertainment', 'Health', 'Other'];

  // Custom Modal for Messages
  const Modal = ({ message, onClose }) => {
    if (!showModal) return null;
    return (
      <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full">
          <h3 className="text-xl font-bold mb-4 text-center text-gray-900">{message.type === 'error' ? 'Error' : 'Success'}</h3>
          <p className="text-gray-700 text-center">{message.text}</p>
          <div className="flex justify-center mt-4">
            <button 
              onClick={onClose} 
              className="bg-sky-600 hover:bg-sky-700 text-white font-bold py-2 px-4 rounded-lg shadow-lg transition-transform transform hover:scale-105"
            >
              OK
            </button>
          </div>
        </div>
      </div>
    );
  };

  const showAppMessage = (text, type) => {
    setMessage({ text, type });
    setShowModal(true);
    setTimeout(() => {
      setShowModal(false);
      setMessage({ text: '', type: '' });
    }, 3000);
  };

  // Firebase Initialization & Authentication
  useEffect(() => {
    try {
      if (Object.keys(firebaseConfig).length === 0) {
        console.error("Firebase config is not provided.");
        return;
      }
      const app = initializeApp(firebaseConfig);
      const firestoreDb = getFirestore(app);
      const firestoreAuth = getAuth(app);
      setDb(firestoreDb);
      setAuth(firestoreAuth);

      if (initialAuthToken) {
        signInWithCustomToken(firestoreAuth, initialAuthToken)
          .then(userCredential => {
            console.log("Signed in with custom token:", userCredential.user.uid);
            setUserId(userCredential.user.uid);
            setIsAuthReady(true);
          })
          .catch(error => {
            console.error("Custom token sign-in failed:", error);
            signInAnonymously(firestoreAuth).then(() => {
              console.log("Signed in anonymously.");
              setUserId(firestoreAuth.currentUser.uid);
              setIsAuthReady(true);
            }).catch(anonError => {
              console.error("Anonymous sign-in failed:", anonError);
            });
          });
      } else {
        signInAnonymously(firestoreAuth)
          .then(() => {
            console.log("Signed in anonymously.");
            setUserId(firestoreAuth.currentUser.uid);
            setIsAuthReady(true);
          })
          .catch(error => {
            console.error("Anonymous sign-in failed:", error);
          });
      }
    } catch (error) {
      console.error("Firebase initialization failed:", error);
    }
  }, []);

  // Firestore Data Listeners
  useEffect(() => {
    if (!db || !userId) return;
    const rootAppId = appId.split('/')[0];
    const userRootPath = `/artifacts/${rootAppId}/users/${userId}`;

    // Transactions Listener
    const transactionsCollection = collection(db, `${userRootPath}/transactions`);
    const transactionsQuery = query(transactionsCollection);
    const unsubscribeTransactions = onSnapshot(transactionsQuery, (snapshot) => {
      const fetchedTransactions = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setTransactions(fetchedTransactions);
    }, (error) => {
      console.error("Error fetching transactions:", error);
    });

    // Recurring Transactions Listener
    const recurringCollection = collection(db, `${userRootPath}/recurring`);
    const recurringQuery = query(recurringCollection);
    const unsubscribeRecurring = onSnapshot(recurringQuery, (snapshot) => {
      const fetchedRecurring = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setRecurringTransactions(fetchedRecurring);
    }, (error) => {
      console.error("Error fetching recurring transactions:", error);
    });

    // Budget Listener
    const budgetDocRef = doc(db, `${userRootPath}/budgets/overall`);
    const unsubscribeBudget = onSnapshot(budgetDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setOverallBudgetLimit(data.overallLimit || 0);
        setCategoryBudgets(data.categories || {});
        setBudgetMode(data.mode || 'overall');
      }
    }, (error) => {
      console.error("Error fetching budget:", error);
    });

    // Savings Goals Listener
    const goalsCollection = collection(db, `${userRootPath}/goals`);
    const unsubscribeGoals = onSnapshot(goalsCollection, (snapshot) => {
      const fetchedGoals = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSavingsGoals(fetchedGoals);
    }, (error) => {
      console.error("Error fetching savings goals:", error);
    });

    return () => {
      unsubscribeTransactions();
      unsubscribeRecurring();
      unsubscribeBudget();
      unsubscribeGoals();
    };
  }, [db, userId]);

  // Financial calculations
  useEffect(() => {
    updateSummary();
    updateSpendingData();
  }, [transactions, recurringTransactions, overallBudgetLimit, categoryBudgets, budgetPeriodType, customStartDate, customEndDate]);

  const getPeriodDates = () => {
    const now = new Date();
    let startDate = new Date();
    let endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    if (budgetPeriodType === 'monthly') {
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);
    } else if (budgetPeriodType === 'weekly') {
      const dayOfWeek = now.getDay();
      const diff = now.getDate() - dayOfWeek;
      startDate = new Date(now.setDate(diff));
      startDate.setHours(0, 0, 0, 0);
    } else if (budgetPeriodType === 'custom') {
      startDate = new Date(customStartDate);
      endDate = new Date(customEndDate);
    }

    return { startDate, endDate };
  };

  const updateSummary = () => {
    const { startDate, endDate } = getPeriodDates();
    let income = 0;
    let expenses = 0;

    const filteredTransactions = transactions.filter(t => {
      const transactionDate = t.createdAt ? t.createdAt.toDate() : new Date();
      return transactionDate >= startDate && transactionDate <= endDate;
    });

    filteredTransactions.forEach(t => {
      if (t.type === 'income') {
        income += t.amount;
      } else {
        expenses += t.amount;
      }
    });

    // Add recurring transactions based on the period type
    recurringTransactions.forEach(rt => {
      if (rt.type === 'income') {
        income += rt.amount;
      } else {
        expenses += rt.amount;
      }
    });

    setTotalIncome(income);
    setTotalExpenses(expenses);
    setRemaining(overallBudgetLimit - expenses);
  };
  
  const updateSpendingData = () => {
    const { startDate, endDate } = getPeriodDates();
    const data = {};

    expenseCategories.forEach(category => {
      data[category] = {
        name: category,
        expenses: 0,
        budget: categoryBudgets[category] || 0,
      };
    });

    const filteredTransactions = transactions.filter(t => {
      const transactionDate = t.createdAt ? t.createdAt.toDate() : new Date();
      return transactionDate >= startDate && transactionDate <= endDate;
    });

    filteredTransactions.forEach(t => {
      if (t.type === 'expense' && t.category) {
        data[t.category].expenses += t.amount;
      }
    });

    recurringTransactions.forEach(rt => {
      if (rt.type === 'expense' && rt.category) {
        data[rt.category].expenses += rt.amount;
      }
    });

    setSpendingData(Object.values(data));
  };

  const handleAddOrUpdateTransaction = async (type) => {
    if (!db || !userId) return;
    try {
      const amount = type === 'income' ? newIncomeAmount : newExpenseAmount;
      const description = type === 'income' ? newIncomeSource : newExpenseDescription;
      const category = type === 'expense' ? newExpenseCategory : '';

      if (amount <= 0 || !description.trim() || (type === 'expense' && !category)) {
        showAppMessage("Please fill in all fields correctly.", "error");
        return;
      }

      const transactionData = {
        type,
        amount: parseFloat(amount),
        description,
        category,
        createdAt: serverTimestamp(),
      };

      const rootAppId = appId.split('/')[0];
      const userTransactionsRef = collection(db, `/artifacts/${rootAppId}/users/${userId}/transactions`);

      if (editingTransaction) {
        await updateDoc(doc(db, userTransactionsRef, editingTransaction.id), transactionData);
        showAppMessage("Transaction updated successfully!", "success");
        setEditingTransaction(null);
      } else {
        await addDoc(userTransactionsRef, transactionData);
        showAppMessage("Transaction added successfully!", "success");
      }

      setNewIncomeAmount('');
      setNewIncomeSource('');
      setNewExpenseAmount('');
      setNewExpenseDescription('');
      setNewExpenseCategory('');
    } catch (error) {
      console.error("Error adding/updating transaction:", error);
      showAppMessage("Failed to save transaction.", "error");
    }
  };

  const handleEdit = (transaction) => {
    setEditingTransaction(transaction);
    if (transaction.type === 'income') {
      setNewIncomeSource(transaction.source);
      setNewIncomeAmount(transaction.amount);
    } else {
      setNewExpenseDescription(transaction.description);
      setNewExpenseAmount(transaction.amount);
      setNewExpenseCategory(transaction.category);
    }
  };

  const handleDeleteItem = async (itemId, collectionName) => {
    if (!db || !userId) return;
    try {
      const rootAppId = appId.split('/')[0];
      const itemRef = doc(db, `/artifacts/${rootAppId}/users/${userId}/${collectionName}`, itemId);
      await deleteDoc(itemRef);
      showAppMessage("Item deleted successfully!", "success");
    } catch (error) {
      console.error("Error deleting item:", error);
      showAppMessage("Failed to delete item.", "error");
    }
  };
  
  const handleAddRecurringTransaction = async () => {
    if (!db || !userId) return;
    if (newRecurringAmount <= 0 || !newRecurringDescription.trim() || (newRecurringType === 'expense' && !newRecurringCategory)) {
      showAppMessage("Please fill in all recurring transaction fields.", "error");
      return;
    }

    try {
      const recurringData = {
        type: newRecurringType,
        amount: parseFloat(newRecurringAmount),
        description: newRecurringDescription,
        frequency: newRecurringFrequency,
        category: newRecurringType === 'expense' ? newRecurringCategory : '',
      };
      const rootAppId = appId.split('/')[0];
      await addDoc(collection(db, `/artifacts/${rootAppId}/users/${userId}/recurring`), recurringData);
      showAppMessage("Recurring transaction added!", "success");
      setNewRecurringAmount('');
      setNewRecurringDescription('');
      setNewRecurringCategory('');
      setNewRecurringFrequency('monthly');
      setNewRecurringType('expense');
    } catch (error) {
      console.error("Error adding recurring transaction:", error);
      showAppMessage("Failed to add recurring transaction.", "error");
    }
  };

  const handleAddOverallBudget = async () => {
    if (!db || !userId) return;
    const limit = parseFloat(newOverallBudgetLimit);
    if (isNaN(limit) || limit <= 0) {
      showAppMessage("Please enter a valid budget amount.", "error");
      return;
    }
    
    try {
      const rootAppId = appId.split('/')[0];
      await setDoc(doc(db, `/artifacts/${rootAppId}/users/${userId}/budgets/overall`), {
        overallLimit: limit,
        mode: 'overall',
      }, { merge: true });
      showAppMessage("Overall budget limit saved!", "success");
      setNewOverallBudgetLimit('');
    } catch (error) {
      console.error("Error saving budget limit:", error);
      showAppMessage("Failed to save budget limit.", "error");
    }
  };

  const handleAddCategoryBudget = async () => {
    if (!db || !userId) return;
    const amount = parseFloat(newCategoryBudgetAmount);
    if (isNaN(amount) || amount <= 0 || !newCategoryBudgetCategory) {
      showAppMessage("Please enter a valid amount and select a category.", "error");
      return;
    }

    try {
      const newBudgets = {
        ...categoryBudgets,
        [newCategoryBudgetCategory]: amount,
      };
      const rootAppId = appId.split('/')[0];
      await setDoc(doc(db, `/artifacts/${rootAppId}/users/${userId}/budgets/overall`), {
        categories: newBudgets,
        mode: 'category'
      }, { merge: true });
      showAppMessage("Category budget saved!", "success");
      setNewCategoryBudgetAmount('');
      setNewCategoryBudgetCategory('');
    } catch (error) {
      console.error("Error saving category budget:", error);
      showAppMessage("Failed to save category budget.", "error");
    }
  };

  const handleAddSavingsGoal = async () => {
    if (!db || !userId) return;
    if (!newGoalName.trim() || parseFloat(newGoalTarget) <= 0) {
      showAppMessage("Please enter a valid goal name and target amount.", "error");
      return;
    }

    try {
      const rootAppId = appId.split('/')[0];
      await addDoc(collection(db, `/artifacts/${rootAppId}/users/${userId}/goals`), {
        name: newGoalName,
        target: parseFloat(newGoalTarget),
        current: 0,
      });
      showAppMessage("Savings goal created!", "success");
      setNewGoalName('');
      setNewGoalTarget('');
    } catch (error) {
      console.error("Error adding savings goal:", error);
      showAppMessage("Failed to create savings goal.", "error");
    }
  };

  const handleContributeToGoal = async () => {
    if (!db || !userId) return;
    if (!selectedGoalId || parseFloat(contributionAmount) <= 0) {
      showAppMessage("Please select a goal and enter a valid contribution amount.", "error");
      return;
    }

    try {
      const rootAppId = appId.split('/')[0];
      const goalRef = doc(db, `/artifacts/${rootAppId}/users/${userId}/goals`, selectedGoalId);
      const goalToUpdate = savingsGoals.find(g => g.id === selectedGoalId);
      if (goalToUpdate) {
        const newCurrent = goalToUpdate.current + parseFloat(contributionAmount);
        await updateDoc(goalRef, {
          current: newCurrent
        });
        showAppMessage("Contribution added successfully!", "success");
      }
      setSelectedGoalId('');
      setContributionAmount('');
    } catch (error) {
      console.error("Error contributing to goal:", error);
      showAppMessage("Failed to add contribution.", "error");
    }
  };
  
  if (!isAuthReady) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 sm:p-6 md:p-8 font-sans bg-gray-100 text-gray-900`}>
        <div className="text-xl font-bold text-sky-600">Loading...</div>
      </div>
    );
  }
  
  return (
    <div className={`min-h-screen flex flex-col items-center p-4 sm:p-6 md:p-8 font-sans bg-gray-100 text-gray-900`}>
      <Modal message={message} onClose={() => setShowModal(false)} />
      
      {/* User ID */}
      <div className="w-full flex justify-end items-center mb-6">
        <div className="flex items-center space-x-2">
          <p className="text-xs text-gray-500">User ID: {userId}</p>
        </div>
      </div>

      <div className="w-full max-w-4xl bg-white p-6 sm:p-8 md:p-10 rounded-lg shadow-2xl">
        <h1 className="text-4xl font-extrabold text-center text-sky-600 mb-2">Budget Buddy</h1>
        <p className="text-center text-sm text-gray-600 mb-6">Your personal finance manager.</p>

        {/* Budget Settings */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Budget Settings</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="p-4 rounded-lg bg-gray-200 shadow-md">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Set Overall Budget</h3>
              <div className="flex space-x-2">
                <input
                  type="number"
                  placeholder="e.g. 2000"
                  value={newOverallBudgetLimit}
                  onChange={(e) => setNewOverallBudgetLimit(e.target.value)}
                  className="w-full p-2 rounded-lg bg-gray-100 text-gray-900 placeholder-gray-400 border border-gray-300 focus:outline-none focus:border-sky-500"
                />
                <button
                  onClick={handleAddOverallBudget}
                  className="bg-sky-600 hover:bg-sky-700 text-white font-bold py-2 px-4 rounded-lg shadow-lg transition-transform transform hover:scale-105"
                >
                  Set
                </button>
              </div>
            </div>
            <div className="p-4 rounded-lg bg-gray-200 shadow-md">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Set Category Budgets</h3>
              <div className="flex space-x-2">
                <select
                  value={newCategoryBudgetCategory}
                  onChange={(e) => setNewCategoryBudgetCategory(e.target.value)}
                  className="w-full p-2 rounded-lg bg-gray-100 text-gray-900 border border-gray-300 focus:outline-none focus:border-sky-500"
                >
                  <option value="">Select Category</option>
                  {expenseCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <input
                  type="number"
                  placeholder="Amount"
                  value={newCategoryBudgetAmount}
                  onChange={(e) => setNewCategoryBudgetAmount(e.target.value)}
                  className="w-full p-2 rounded-lg bg-gray-100 text-gray-900 placeholder-gray-400 border border-gray-300 focus:outline-none focus:border-sky-500"
                />
                <button
                  onClick={handleAddCategoryBudget}
                  className="bg-sky-600 hover:bg-sky-700 text-white font-bold py-2 px-4 rounded-lg shadow-lg transition-transform transform hover:scale-105"
                >
                  Set
                </button>
              </div>
            </div>
          </div>
          <div className="flex justify-center sm:justify-end gap-4 mt-4">
            <select
              value={budgetPeriodType}
              onChange={(e) => setBudgetPeriodType(e.target.value)}
              className="p-2 rounded-lg bg-gray-200 text-gray-900 border border-gray-300"
            >
              <option value="monthly">Monthly</option>
              <option value="weekly">Weekly</option>
              <option value="custom">Custom</option>
            </select>
          </div>
          {budgetPeriodType === 'custom' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="p-2 rounded-lg bg-gray-200 text-gray-900 border border-gray-300"
              />
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="p-2 rounded-lg bg-gray-200 text-gray-900 border border-gray-300"
              />
            </div>
          )}
        </div>

        <hr className="border-gray-300 my-8" />
        
        {/* Budget Summary */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Summary</h2>
          {budgetMode === 'overall' ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
              <div className="bg-gray-200 p-4 rounded-lg shadow-md">
                <p className="text-lg text-gray-600">Overall Budget Limit</p>
                <p className="text-2xl font-bold text-sky-600">${overallBudgetLimit.toFixed(2)}</p>
              </div>
              <div className="bg-gray-200 p-4 rounded-lg shadow-md">
                <p className="text-lg text-gray-600">Total Expenses</p>
                <p className="text-2xl font-bold text-red-600">${totalExpenses.toFixed(2)}</p>
              </div>
              <div className="bg-gray-200 p-4 rounded-lg shadow-md">
                <p className="text-lg text-gray-600">Remaining</p>
                <p className={`text-2xl font-bold ${remaining >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>${remaining.toFixed(2)}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {spendingData.length > 0 ? spendingData.map(data => (
                <div key={data.name} className="bg-gray-200 p-4 rounded-lg shadow-md">
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-lg text-gray-900 font-bold">{data.name}</p>
                    <p className="text-sm text-gray-600">${data.expenses.toFixed(2)} / ${data.budget.toFixed(2)}</p>
                  </div>
                  <div className="w-full bg-gray-300 rounded-full h-2.5">
                    <div 
                      className={`h-2.5 rounded-full ${data.expenses > data.budget ? 'bg-red-400' : 'bg-emerald-400'}`} 
                      style={{ width: `${Math.min(100, (data.expenses / data.budget) * 100)}%` }}
                    ></div>
                  </div>
                </div>
              )) : (
                <p className="text-gray-600 text-center">No expense data to display for this period.</p>
              )}
            </div>
          )}
        </div>
        
        <hr className="border-gray-300 my-8" />

        {/* Spending Chart */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Spending by Category</h2>
          {spendingData.length > 0 ? (
            <div className="w-full h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={spendingData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                  <XAxis dataKey="name" stroke="#4b5563" />
                  <YAxis stroke="#4b5563" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#e5e7eb', border: 'none', borderRadius: '8px' }}
                    itemStyle={{ color: '#1f2937' }}
                  />
                  <Bar dataKey="expenses" fill="#f87171" radius={[10, 10, 0, 0]} name="Expenses"/>
                  {budgetMode === 'category' && <Bar dataKey="budget" fill="#14b8a6" radius={[10, 10, 0, 0]} name="Category Budget"/>}
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-gray-600 text-center">No expense data to display for this period.</p>
          )}
        </div>
        
        {/* Transactions Section */}
        <h1 className="text-4xl font-bold text-sky-400">Transactions</h1>
        <p className="text-center text-sm text-gray-600 mb-6">Manage all your one-time and recurring transactions.</p>
        
        <hr className="border-gray-300 my-8"/>
        
        {/* Add/Edit Income */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">{editingTransaction && editingTransaction.type === 'income' ? 'Edit Income' : 'Add One-Time Income'}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <input
              type="text"
              placeholder="Source (e.g., Paycheck)"
              value={newIncomeSource}
              onChange={(e) => setNewIncomeSource(e.target.value)}
              className="p-3 rounded-lg bg-gray-200 text-gray-900 placeholder-gray-400 border border-gray-300 focus:outline-none focus:border-sky-500"
              disabled={editingTransaction && editingTransaction.type === 'expense'}
            />
            <input
              type="number"
              placeholder="Amount ($)"
              value={newIncomeAmount}
              onChange={(e) => setNewIncomeAmount(e.target.value)}
              className="p-3 rounded-lg bg-gray-200 text-gray-900 placeholder-gray-400 border border-gray-300 focus:outline-none focus:border-sky-500"
              disabled={editingTransaction && editingTransaction.type === 'expense'}
            />
          </div>
          <div className="flex justify-center sm:justify-end gap-2">
            {editingTransaction && editingTransaction.type === 'income' && (
              <button
                onClick={() => setEditingTransaction(null)}
                className="bg-gray-400 hover:bg-gray-500 text-gray-900 font-bold py-3 px-6 rounded-lg shadow-lg transition-transform transform hover:scale-105 w-full sm:w-auto"
              >
                Cancel
              </button>
            )}
            <button
              onClick={() => handleAddOrUpdateTransaction('income')}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-transform transform hover:scale-105 w-full sm:w-auto"
              disabled={editingTransaction && editingTransaction.type === 'income'}
            >
              {editingTransaction && editingTransaction.type === 'income' ? 'Update Income' : 'Add Income'}
            </button>
          </div>
        </div>

        {/* Add/Edit Expense */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">{editingTransaction && editingTransaction.type === 'expense' ? 'Edit Expense' : 'Add One-Time Expense'}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <input
              type="text"
              placeholder="Description"
              value={newExpenseDescription}
              onChange={(e) => setNewExpenseDescription(e.target.value)}
              className="p-3 rounded-lg bg-gray-200 text-gray-900 placeholder-gray-400 border border-gray-300 focus:outline-none focus:border-sky-500"
              disabled={editingTransaction && editingTransaction.type === 'income'}
            />
            <input
              type="number"
              placeholder="Amount ($)"
              value={newExpenseAmount}
              onChange={(e) => setNewExpenseAmount(e.target.value)}
              className="p-3 rounded-lg bg-gray-200 text-gray-900 placeholder-gray-400 border border-gray-300 focus:outline-none focus:border-sky-500"
              disabled={editingTransaction && editingTransaction.type === 'income'}
            />
            <select
              value={newExpenseCategory}
              onChange={(e) => setNewExpenseCategory(e.target.value)}
              className="p-3 rounded-lg bg-gray-200 text-gray-900 border border-gray-300 focus:outline-none focus:border-sky-500"
              disabled={editingTransaction && editingTransaction.type === 'income'}
            >
              <option value="">Select Category</option>
              {expenseCategories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-center sm:justify-end gap-2">
            {editingTransaction && editingTransaction.type === 'expense' && (
              <button
                onClick={() => setEditingTransaction(null)}
                className="bg-gray-400 hover:bg-gray-500 text-gray-900 font-bold py-3 px-6 rounded-lg shadow-lg transition-transform transform hover:scale-105 w-full sm:w-auto"
              >
                Cancel
              </button>
            )}
            <button
              onClick={() => handleAddOrUpdateTransaction('expense')}
              className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-transform transform hover:scale-105 w-full sm:w-auto"
              disabled={editingTransaction && editingTransaction.type === 'income'}
            >
              {editingTransaction && editingTransaction.type === 'expense' ? 'Update Expense' : 'Add Expense'}
            </button>
          </div>
        </div>
        
        <hr className="border-gray-300 my-8"/>
        
        {/* Recurring Transactions */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Set Recurring Transaction</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <input
              type="text"
              placeholder="Description (e.g., Rent, Salary)"
              value={newRecurringDescription}
              onChange={(e) => setNewRecurringDescription(e.target.value)}
              className="p-3 rounded-lg bg-gray-200 text-gray-900 placeholder-gray-400 border border-gray-300 focus:outline-none focus:border-sky-500"
            />
            <input
              type="number"
              placeholder="Amount ($)"
              value={newRecurringAmount}
              onChange={(e) => setNewRecurringAmount(e.target.value)}
              className="p-3 rounded-lg bg-gray-200 text-gray-900 placeholder-gray-400 border border-gray-300 focus:outline-none focus:border-sky-500"
            />
            <select
              value={newRecurringFrequency}
              onChange={(e) => setNewRecurringFrequency(e.target.value)}
              className="p-3 rounded-lg bg-gray-200 text-gray-900 border border-gray-300 focus:outline-none focus:border-sky-500"
            >
              <option value="monthly">Monthly</option>
              <option value="weekly">Weekly</option>
            </select>
            <select
              value={newRecurringType}
              onChange={(e) => setNewRecurringType(e.target.value)}
              className="p-3 rounded-lg bg-gray-200 text-gray-900 border border-gray-300 focus:outline-none focus:border-sky-500"
            >
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
            {newRecurringType === 'expense' && (
              <select
                value={newRecurringCategory}
                onChange={(e) => setNewRecurringCategory(e.target.value)}
                className="p-3 rounded-lg bg-gray-200 text-gray-900 border border-gray-300 focus:outline-none focus:border-sky-500"
              >
                <option value="">Select Category</option>
                {expenseCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={handleAddRecurringTransaction}
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-transform transform hover:scale-105 w-full sm:w-auto"
            >
              Add Recurring Transaction
            </button>
          </div>
          <div className="mt-6">
            <h3 className="text-xl font-bold text-gray-900 mb-2">Your Recurring Transactions</h3>
            {recurringTransactions.length === 0 ? (
              <p className="text-gray-600">No recurring transactions set up yet.</p>
            ) : (
              <ul className="space-y-4">
                {recurringTransactions.map(t => (
                  <li key={t.id} className="bg-gray-200 p-4 rounded-lg shadow-md flex justify-between items-center">
                    <div>
                      <p className="text-lg font-bold text-gray-900">{t.description}</p>
                      <p className="text-sm text-gray-600">{t.type} - {t.frequency}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`text-xl font-bold ${t.type === 'income' ? 'text-emerald-300' : 'text-red-300'}`}>
                        {t.type === 'income' ? '+' : '-'}${t.amount.toFixed(2)}
                      </span>
                      <button 
                        onClick={() => handleDeleteItem(t.id, 'recurring')}
                        className="p-2 rounded-full bg-red-600 hover:bg-red-700 text-white"
                        title="Delete Recurring Transaction"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm6 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        
        <hr className="border-gray-300 my-8"/>
        
        {/* History */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">One-Time Transaction History</h2>
          {transactions.length === 0 ? (
            <p className="text-gray-600 text-center">No transactions added yet.</p>
          ) : (
            <ul className="space-y-4">
              {transactions
                .filter(t => {
                  const { startDate, endDate } = getPeriodDates();
                  const transactionDate = t.createdAt ? t.createdAt.toDate() : new Date();
                  return transactionDate >= startDate && transactionDate <= endDate;
                })
                .map(transaction => (
                  <li key={transaction.id} className="bg-gray-200 p-4 rounded-lg shadow-md flex justify-between items-center transition-all duration-300 transform hover:bg-gray-300">
                    <div className="flex flex-col">
                      <p className="text-lg font-bold text-gray-900">{transaction.description || transaction.source}</p>
                      <p className="text-sm text-gray-600">{transaction.category ? transaction.category : 'Income'}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`text-xl font-bold ${transaction.type === 'income' ? 'text-emerald-300' : 'text-red-300'}`}>
                        {transaction.type === 'income' ? '+' : '-'}${transaction.amount.toFixed(2)}
                      </span>
                      <button 
                        onClick={() => handleEdit(transaction)}
                        className="p-2 rounded-full bg-sky-600 hover:bg-sky-700 text-white"
                        title="Edit Transaction"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zm-7.586 7.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.96 9.414L10 11.374V14h2.626l1.96-1.96-2.626-2.626z" />
                          <path fillRule="evenodd" d="M4 16a2 2 0 01-2-2v-4a2 2 0 012-2h4a2 2 0 012 2v4a2 2 0 01-2 2H4zM16 4a2 2 0 00-2-2h-4a2 2 0 00-2 2v4a2 2 0 002 2h4a2 2 0 002-2V4z" clipRule="evenodd" />
                        </svg>
                      </button>
                      <button 
                        onClick={() => handleDeleteItem(transaction.id, 'transactions')}
                        className="p-2 rounded-full bg-red-600 hover:bg-red-700 text-white"
                        title="Delete Transaction"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm6 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  </li>
                ))}
            </ul>
          )}
        </div>
        
        {/* Savings Goals Section */}
        <h1 className="text-4xl font-bold text-sky-400 mt-12">Savings Goals</h1>
        <p className="text-center text-sm text-gray-600 mb-6">Create and track your progress towards financial goals.</p>

        <hr className="border-gray-300 my-8"/>

        {/* Add Savings Goals */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Create New Goal</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Goal Name (e.g., Vacation)"
              value={newGoalName}
              onChange={(e) => setNewGoalName(e.target.value)}
              className="p-3 rounded-lg bg-gray-200 text-gray-900 placeholder-gray-400 border border-gray-300 focus:outline-none focus:border-sky-500"
            />
            <input
              type="number"
              placeholder="Target Amount ($)"
              value={newGoalTarget}
              onChange={(e) => setNewGoalTarget(e.target.value)}
              className="p-3 rounded-lg bg-gray-200 text-gray-900 placeholder-gray-400 border border-gray-300 focus:outline-none focus:border-sky-500"
            />
            <button
              onClick={handleAddSavingsGoal}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-transform transform hover:scale-105 w-full md:col-span-2"
            >
              Create Goal
            </button>
          </div>
        </div>
        
        <hr className="border-gray-300 my-8"/>

        {/* Savings Goal List */}
        <div className="mt-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Your Goals</h2>
          {savingsGoals.length === 0 ? (
            <p className="text-gray-600">No savings goals created yet.</p>
          ) : (
            <ul className="space-y-4">
              {savingsGoals.map(goal => {
                const progress = Math.min(100, (goal.current / goal.target) * 100);
                return (
                  <li key={goal.id} className="bg-gray-200 p-4 rounded-lg shadow-md flex flex-col">
                    <div className="flex justify-between items-center mb-2">
                      <p className="text-lg font-bold text-gray-900">{goal.name}</p>
                      <span className="text-sm font-semibold text-gray-600">
                          ${goal.current.toFixed(2)} / ${goal.target.toFixed(2)}
                      </span>
                    </div>
                    <div className="w-full bg-gray-300 rounded-full h-2.5 mb-2">
                      <div 
                        className="h-2.5 rounded-full bg-emerald-400" 
                        style={{ width: `${progress}%` }}
                      ></div>
                    </div>
                    <div className="flex items-center gap-4 mt-2">
                      <button
                        onClick={() => handleDeleteItem(goal.id, 'goals')}
                        className="p-2 rounded-full bg-red-600 hover:bg-red-700 text-white"
                        title="Delete Goal"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm6 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" />
                        </svg>
                      </button>
                      <select
                        value={selectedGoalId}
                        onChange={(e) => setSelectedGoalId(e.target.value)}
                        className="p-2 rounded-lg bg-gray-200 text-gray-900 text-sm focus:outline-none focus:border-sky-500"
                      >
                        <option value="">Contribute to goal</option>
                        {savingsGoals.map(g => (
                            <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        placeholder="Amount"
                        value={contributionAmount}
                        onChange={(e) => setContributionAmount(e.target.value)}
                        className="p-2 rounded-lg bg-gray-200 text-gray-900 placeholder-gray-400 text-sm w-24 focus:outline-none focus:border-sky-500"
                      />
                      <button
                        onClick={handleContributeToGoal}
                        className="p-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm"
                      >
                          Add
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;