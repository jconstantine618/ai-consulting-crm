import React, { useState, useEffect, createContext, useContext, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, getDoc, addDoc, setDoc, updateDoc, deleteDoc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';

// Create a context for Firebase and user data
const AppContext = createContext(null);

// Custom hook to use the app context
const useAppContext = () => useContext(AppContext);

// Placeholder for a custom modal component (instead of alert/confirm)
const CustomModal = ({ message, onConfirm, onCancel, show }) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full text-center">
        <p className="text-lg mb-4">{message}</p>
        <div className="flex justify-center space-x-4">
          {onConfirm && (
            <button
              onClick={onConfirm}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
            >
              Confirm
            </button>
          )}
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-opacity-50"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// --- Components for each section ---

const Dashboard = () => {
  const { userId, db, contacts, deals, projects, loading } = useAppContext();
  const [dashboardData, setDashboardData] = useState({
    totalContacts: 0,
    activeDeals: 0,
    pipelineValue: 0,
    closedDeals: 0,
    recentActivity: [],
    upcomingDeals: []
  });

  useEffect(() => {
    if (userId && contacts && deals && projects) {
      const totalContacts = contacts.length;
      const activeDeals = deals.filter(deal => deal.stage !== 'Proposal Accepted (Won)').length;
      const pipelineValue = deals
        .filter(deal => deal.stage !== 'Proposal Accepted (Won)')
        .reduce((sum, deal) => sum + (deal.value || 0), 0);
      const closedDeals = deals.filter(deal => deal.stage === 'Proposal Accepted (Won)').length;

      // Simple recent activity (could be more sophisticated with timestamps)
      const recentActivity = [
        ...contacts.map(c => ({ type: 'contact', name: c.name, date: c.lastContacted || 'N/A' })),
        ...deals.map(d => ({ type: 'deal', name: d.name, stage: d.stage, date: d.expectedCloseDate || 'N/A' })),
        ...projects.map(p => ({ type: 'project', name: p.name, client: p.client, date: p.startDate || 'N/A' }))
      ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5); // Get latest 5

      const upcomingDeals = deals
        .filter(deal => deal.stage !== 'Proposal Accepted (Won)')
        .sort((a, b) => new Date(a.expectedCloseDate) - new Date(b.expectedCloseDate))
        .slice(0, 3); // Get upcoming 3

      setDashboardData({
        totalContacts,
        activeDeals,
        pipelineValue,
        closedDeals,
        recentActivity,
        upcomingDeals
      });
    }
  }, [userId, contacts, deals, projects]);

  if (loading) {
    return <div className="p-4 text-center text-gray-600">Loading dashboard...</div>;
  }

  return (
    <div className="p-4 md:p-8 bg-gray-50 min-h-screen">
      <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">Dashboard</h1>
      <p className="text-gray-600 mb-6">Welcome back! Here's what's happening with your business.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-md font-semibold text-gray-700">Total Contacts</h3>
          <p className="text-3xl font-bold text-blue-600 mt-1">{dashboardData.totalContacts}</p>
          <p className="text-sm text-gray-500">+12% from last month</p>
        </div>
        <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-md font-semibold text-gray-700">Active Deals</h3>
          <p className="text-3xl font-bold text-green-600 mt-1">{dashboardData.activeDeals}</p>
          <p className="text-sm text-gray-500">+8% from last month</p>
        </div>
        <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-md font-semibold text-gray-700">Pipeline Value</h3>
          <p className="text-3xl font-bold text-purple-600 mt-1">${dashboardData.pipelineValue.toLocaleString()}</p>
          <p className="text-sm text-gray-500">+15% from last month</p>
        </div>
        <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-md font-semibold text-gray-700">Closed Deals</h3>
          <p className="text-3xl font-bold text-red-600 mt-1">{dashboardData.closedDeals}</p>
          <p className="text-sm text-gray-500">+5% from last month</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Recent Activity</h3>
          {dashboardData.recentActivity.length > 0 ? (
            <ul>
              {dashboardData.recentActivity.map((activity, index) => (
                <li key={index} className="flex items-center py-2 border-b last:border-b-0 border-gray-100">
                  <span className={`w-2 h-2 rounded-full mr-3 ${activity.type === 'contact' ? 'bg-blue-400' : activity.type === 'deal' ? 'bg-green-400' : 'bg-purple-400'}`}></span>
                  <p className="text-gray-700 text-sm">
                    {activity.type === 'contact' && `New contact: ${activity.name}`}
                    {activity.type === 'deal' && `Deal update: ${activity.name} moved to ${activity.stage}`}
                    {activity.type === 'project' && `New project: ${activity.name} for ${activity.client}`}
                    <span className="text-gray-500 ml-2 text-xs">{activity.date}</span>
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500 text-center py-4">No recent activity</p>
          )}
        </div>

        <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Upcoming Deals</h3>
          {dashboardData.upcomingDeals.length > 0 ? (
            <ul>
              {dashboardData.upcomingDeals.map(deal => (
                <li key={deal.id} className="flex justify-between items-center py-2 border-b last:border-b-0 border-gray-100">
                  <div>
                    <p className="text-gray-700 font-medium">{deal.name}</p>
                    <p className="text-sm text-gray-600">{deal.company} - ${deal.value?.toLocaleString()}</p>
                  </div>
                  <div className="flex items-center">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      deal.stage === 'Initial Contact' ? 'bg-blue-100 text-blue-800' :
                      deal.stage === 'First Meeting Scheduled' ? 'bg-yellow-100 text-yellow-800' :
                      deal.stage === 'First Meeting Held' ? 'bg-orange-100 text-orange-800' :
                      deal.stage === 'Proposal Sent' ? 'bg-purple-100 text-purple-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {deal.stage}
                    </span>
                    <span className="text-sm text-gray-500 ml-3">{deal.expectedCloseDate}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500 text-center py-4">No upcoming deals</p>
          )}
        </div>
      </div>
    </div>
  );
};


const Contacts = () => {
  const { userId, db, contacts, addContact, updateContact, deleteContact, loading } = useAppContext();
  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [currentContact, setCurrentContact] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [contactToDelete, setContactToDelete] = useState(null);

  const filteredContacts = contacts.filter(contact =>
    contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddClick = () => {
    setCurrentContact(null);
    setShowAddEditModal(true);
  };

  const handleEditClick = (contact) => {
    setCurrentContact(contact);
    setShowAddEditModal(true);
  };

  const handleDeleteClick = (contact) => {
    setContactToDelete(contact);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (contactToDelete) {
      await deleteContact(contactToDelete.id);
      setShowDeleteConfirm(false);
      setContactToDelete(null);
    }
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setContactToDelete(null);
  };

  if (loading) {
    return <div className="p-4 text-center text-gray-600">Loading contacts...</div>;
  }

  return (
    <div className="p-4 md:p-8 bg-gray-50 min-h-screen">
      <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">Contacts</h1>
      <p className="text-gray-600 mb-6">Manage your business contacts and relationships.</p>

      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <input
          type="text"
          placeholder="Search contacts..."
          className="p-3 border border-gray-300 rounded-md w-full sm:w-2/3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <button
          onClick={handleAddClick}
          className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white rounded-md shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition duration-200 ease-in-out"
        >
          + Add Contact
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredContacts.length > 0 ? (
          filteredContacts.map(contact => (
            <div key={contact.id} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-lg mr-3">
                    {contact.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">{contact.name}</h3>
                    <p className="text-sm text-gray-600">{contact.company}</p>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button onClick={() => handleEditClick(contact)} className="text-gray-500 hover:text-blue-600">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zm-3.646 3.646l-6 6V17h5.364l6-6-2.828-2.828z" />
                    </svg>
                  </button>
                  <button onClick={() => handleDeleteClick(contact)} className="text-gray-500 hover:text-red-600">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="text-sm text-gray-700 flex-grow">
                <p className="mb-1"><strong>Title:</strong> {contact.title}</p>
                <p className="mb-1"><strong>Email:</strong> {contact.email}</p>
                <p className="mb-1"><strong>Phone:</strong> {contact.phone}</p>
                <p className="mt-2 text-gray-600 text-xs">Last contacted: {contact.lastContacted || 'N/A'}</p>
                <p className="mt-2 text-gray-600 text-xs">Notes: {contact.notes || 'N/A'}</p>
              </div>
            </div>
          ))
        ) : (
          <p className="text-gray-500 text-center col-span-full py-8">No contacts found. Add a new contact to get started!</p>
        )}
      </div>

      <ContactForm
        show={showAddEditModal}
        onClose={() => setShowAddEditModal(false)}
        contact={currentContact}
        addContact={addContact}
        updateContact={updateContact}
      />

      <CustomModal
        show={showDeleteConfirm}
        message={`Are you sure you want to delete ${contactToDelete?.name}?`}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </div>
  );
};

const ContactForm = ({ show, onClose, contact, addContact, updateContact }) => {
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    title: '',
    email: '',
    phone: '',
    notes: '',
    lastContacted: new Date().toISOString().split('T')[0] // Default to today
  });

  useEffect(() => {
    if (contact) {
      setFormData({
        name: contact.name || '',
        company: contact.company || '',
        title: contact.title || '',
        email: contact.email || '',
        phone: contact.phone || '',
        notes: contact.notes || '',
        lastContacted: contact.lastContacted || new Date().toISOString().split('T')[0]
      });
    } else {
      setFormData({
        name: '',
        company: '',
        title: '',
        email: '',
        phone: '',
        notes: '',
        lastContacted: new Date().toISOString().split('T')[0]
      });
    }
  }, [contact, show]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (contact) {
      await updateContact(contact.id, formData);
    } else {
      await addContact(formData);
    }
    onClose();
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">{contact ? 'Edit Contact' : 'Add New Contact'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="name" className="block text-gray-700 text-sm font-bold mb-2">Name</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div className="mb-4">
            <label htmlFor="company" className="block text-gray-700 text-sm font-bold mb-2">Company</label>
            <input
              type="text"
              id="company"
              name="company"
              value={formData.company}
              onChange={handleChange}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="mb-4">
            <label htmlFor="title" className="block text-gray-700 text-sm font-bold mb-2">Title</label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="mb-4">
            <label htmlFor="email" className="block text-gray-700 text-sm font-bold mb-2">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="mb-4">
            <label htmlFor="phone" className="block text-gray-700 text-sm font-bold mb-2">Phone</label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="mb-4">
            <label htmlFor="notes" className="block text-gray-700 text-sm font-bold mb-2">Notes</label>
            <textarea
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows="3"
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
            ></textarea>
          </div>
          <div className="mb-6">
            <label htmlFor="lastContacted" className="block text-gray-700 text-sm font-bold mb-2">Last Contacted Date</label>
            <input
              type="date"
              id="lastContacted"
              name="lastContacted"
              value={formData.lastContacted}
              onChange={handleChange}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center justify-between">
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition duration-200 ease-in-out"
            >
              {contact ? 'Update Contact' : 'Add Contact'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-opacity-50 transition duration-200 ease-in-out"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


const Pipeline = () => {
  const { userId, db, deals, addDeal, updateDeal, deleteDeal, loading } = useAppContext();
  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [currentDeal, setCurrentDeal] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [dealToDelete, setDealToDelete] = useState(null);

  const pipelineStages = [
    'Initial Contact',
    'First Meeting Scheduled',
    'First Meeting Held',
    'Proposal Sent',
    'Proposal Accepted (Won)'
  ];

  const dealsByStage = pipelineStages.reduce((acc, stage) => {
    acc[stage] = deals.filter(deal => deal.stage === stage);
    return acc;
  }, {});

  const handleAddClick = () => {
    setCurrentDeal(null);
    setShowAddEditModal(true);
  };

  const handleEditClick = (deal) => {
    setCurrentDeal(deal);
    setShowAddEditModal(true);
  };

  const handleDeleteClick = (deal) => {
    setDealToDelete(deal);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (dealToDelete) {
      await deleteDeal(dealToDelete.id);
      setShowDeleteConfirm(false);
      setDealToDelete(null);
    }
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setDealToDelete(null);
  };

  const handleMoveDeal = async (deal, newStage) => {
    const newStageIndex = pipelineStages.indexOf(newStage);
    const currentStageIndex = pipelineStages.indexOf(deal.stage);

    // Only allow moving to the next stage or back to previous stages, but not skipping stages forward.
    // Also allow moving to 'Won' from any stage.
    if (newStageIndex === currentStageIndex + 1 || newStageIndex < currentStageIndex || newStage === 'Proposal Accepted (Won)') {
      await updateDeal(deal.id, { stage: newStage });
    } else {
      console.log("Invalid stage transition.");
      // Optionally, show a message to the user about invalid transition
    }
  };

  if (loading) {
    return <div className="p-4 text-center text-gray-600">Loading pipeline...</div>;
  }

  return (
    <div className="p-4 md:p-8 bg-gray-50 min-h-screen">
      <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">Sales Pipeline</h1>
      <p className="text-gray-600 mb-6">Track your deals through the sales process.</p>

      <div className="flex justify-end mb-6">
        <button
          onClick={handleAddClick}
          className="px-6 py-3 bg-blue-600 text-white rounded-md shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition duration-200 ease-in-out"
        >
          + Add Deal
        </button>
      </div>

      <div className="overflow-x-auto pb-4">
        <div className="inline-flex flex-nowrap gap-6 min-w-full">
          {pipelineStages.map(stage => (
            <div key={stage} className="flex-none w-72 bg-white p-5 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                <span className={`w-3 h-3 rounded-full mr-2 ${
                  stage === 'Initial Contact' ? 'bg-blue-500' :
                  stage === 'First Meeting Scheduled' ? 'bg-yellow-500' :
                  stage === 'First Meeting Held' ? 'bg-orange-500' :
                  stage === 'Proposal Sent' ? 'bg-purple-500' :
                  'bg-green-500'
                }`}></span>
                {stage} ({dealsByStage[stage].length})
              </h3>
              <div className="space-y-4">
                {dealsByStage[stage].length > 0 ? (
                  dealsByStage[stage].map(deal => (
                    <div key={deal.id} className="bg-gray-50 p-4 rounded-md border border-gray-100 shadow-sm">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-medium text-gray-800">{deal.name}</p>
                          <p className="text-sm text-gray-600">{deal.company}</p>
                        </div>
                        <div className="flex space-x-2">
                          <button onClick={() => handleEditClick(deal)} className="text-gray-500 hover:text-blue-600">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zm-3.646 3.646l-6 6V17h5.364l6-6-2.828-2.828z" />
                            </svg>
                          </button>
                          <button onClick={() => handleDeleteClick(deal)} className="text-gray-500 hover:text-red-600">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-gray-700 mb-1">${deal.value?.toLocaleString()}</p>
                      <p className="text-xs text-gray-500 mb-2">Expected: {deal.expectedCloseDate}</p>
                      <p className="text-xs text-gray-500 mb-2">{deal.probability}% probability</p>

                      <div className="flex flex-wrap gap-1 mt-2">
                        {pipelineStages.map((s, idx) => (
                          <button
                            key={s}
                            onClick={() => handleMoveDeal(deal, s)}
                            className={`px-2 py-1 text-xs rounded-full transition duration-150 ease-in-out
                              ${deal.stage === s ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-blue-100 hover:text-blue-800'}
                            `}
                            disabled={deal.stage === s}
                          >
                            {s.split(' ')[0]}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-sm text-center py-4">No deals in this stage.</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <DealForm
        show={showAddEditModal}
        onClose={() => setShowAddEditModal(false)}
        deal={currentDeal}
        addDeal={addDeal}
        updateDeal={updateDeal}
        pipelineStages={pipelineStages}
      />

      <CustomModal
        show={showDeleteConfirm}
        message={`Are you sure you want to delete deal "${dealToDelete?.name}"?`}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </div>
  );
};

const DealForm = ({ show, onClose, deal, addDeal, updateDeal, pipelineStages }) => {
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    value: '',
    stage: pipelineStages[0],
    expectedCloseDate: new Date().toISOString().split('T')[0],
    probability: 50,
    notes: ''
  });

  useEffect(() => {
    if (deal) {
      setFormData({
        name: deal.name || '',
        company: deal.company || '',
        value: deal.value || '',
        stage: deal.stage || pipelineStages[0],
        expectedCloseDate: deal.expectedCloseDate || new Date().toISOString().split('T')[0],
        probability: deal.probability || 50,
        notes: deal.notes || ''
      });
    } else {
      setFormData({
        name: '',
        company: '',
        value: '',
        stage: pipelineStages[0],
        expectedCloseDate: new Date().toISOString().split('T')[0],
        probability: 50,
        notes: ''
      });
    }
  }, [deal, show, pipelineStages]);

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (deal) {
      await updateDeal(deal.id, formData);
    } else {
      await addDeal(formData);
    }
    onClose();
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">{deal ? 'Edit Deal' : 'Add New Deal'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="dealName" className="block text-gray-700 text-sm font-bold mb-2">Deal Name</label>
            <input
              type="text"
              id="dealName"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div className="mb-4">
            <label htmlFor="dealCompany" className="block text-gray-700 text-sm font-bold mb-2">Company</label>
            <input
              type="text"
              id="dealCompany"
              name="company"
              value={formData.company}
              onChange={handleChange}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="mb-4">
            <label htmlFor="dealValue" className="block text-gray-700 text-sm font-bold mb-2">Value ($)</label>
            <input
              type="number"
              id="dealValue"
              name="value"
              value={formData.value}
              onChange={handleChange}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="0"
            />
          </div>
          <div className="mb-4">
            <label htmlFor="dealStage" className="block text-gray-700 text-sm font-bold mb-2">Stage</label>
            <select
              id="dealStage"
              name="stage"
              value={formData.stage}
              onChange={handleChange}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {pipelineStages.map(stage => (
                <option key={stage} value={stage}>{stage}</option>
              ))}
            </select>
          </div>
          <div className="mb-4">
            <label htmlFor="expectedCloseDate" className="block text-gray-700 text-sm font-bold mb-2">Expected Close Date</label>
            <input
              type="date"
              id="expectedCloseDate"
              name="expectedCloseDate"
              value={formData.expectedCloseDate}
              onChange={handleChange}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="mb-4">
            <label htmlFor="probability" className="block text-gray-700 text-sm font-bold mb-2">Probability (%)</label>
            <input
              type="range"
              id="probability"
              name="probability"
              value={formData.probability}
              onChange={handleChange}
              min="0"
              max="100"
              step="5"
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer range-lg"
            />
            <span className="text-sm text-gray-600">{formData.probability}%</span>
          </div>
          <div className="mb-6">
            <label htmlFor="dealNotes" className="block text-gray-700 text-sm font-bold mb-2">Notes</label>
            <textarea
              id="dealNotes"
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows="3"
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
            ></textarea>
          </div>
          <div className="flex items-center justify-between">
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition duration-200 ease-in-out"
            >
              {deal ? 'Update Deal' : 'Add Deal'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-opacity-50 transition duration-200 ease-in-out"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


const Projects = () => {
  const { userId, db, projects, addProject, updateProject, deleteProject, loading } = useAppContext();
  const [showAddEditProjectModal, setShowAddEditProjectModal] = useState(false);
  const [currentProject, setCurrentProject] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState(null);

  const handleAddProjectClick = () => {
    setCurrentProject(null);
    setShowAddEditProjectModal(true);
  };

  const handleEditProjectClick = (project) => {
    setCurrentProject(project);
    setShowAddEditProjectModal(true);
  };

  const handleDeleteProjectClick = (project) => {
    setProjectToDelete(project);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (projectToDelete) {
      await deleteProject(projectToDelete.id);
      setShowDeleteConfirm(false);
      setProjectToDelete(null);
    }
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setProjectToDelete(null);
  };

  const handleAddTask = async (projectId, taskName) => {
    const project = projects.find(p => p.id === projectId);
    if (project) {
      const updatedTasks = [...(project.tasks || []), { id: crypto.randomUUID(), name: taskName, completed: false }];
      await updateProject(projectId, { tasks: updatedTasks });
    }
  };

  const handleToggleTask = async (projectId, taskId) => {
    const project = projects.find(p => p.id === projectId);
    if (project) {
      const updatedTasks = (project.tasks || []).map(task =>
        task.id === taskId ? { ...task, completed: !task.completed } : task
      );
      await updateProject(projectId, { tasks: updatedTasks });
    }
  };

  const handleDeleteTask = async (projectId, taskId) => {
    const project = projects.find(p => p.id === projectId);
    if (project) {
      const updatedTasks = (project.tasks || []).filter(task => task.id !== taskId);
      await updateProject(projectId, { tasks: updatedTasks });
    }
  };


  if (loading) {
    return <div className="p-4 text-center text-gray-600">Loading projects...</div>;
  }

  return (
    <div className="p-4 md:p-8 bg-gray-50 min-h-screen">
      <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">Projects</h1>
      <p className="text-gray-600 mb-6">Manage your client projects and tasks.</p>

      <div className="flex flex-col sm:flex-row justify-end items-center mb-6 gap-4">
        {/* <button
          onClick={() => { /* Placeholder for Add Task if needed separately * / }}
          className="w-full sm:w-auto px-6 py-3 bg-gray-200 text-gray-800 rounded-md shadow-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-opacity-50 transition duration-200 ease-in-out"
        >
          + Add Task
        </button> */}
        <button
          onClick={handleAddProjectClick}
          className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white rounded-md shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition duration-200 ease-in-out"
        >
          + Add Project
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.length > 0 ? (
          projects.map(project => (
            <div key={project.id} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">{project.name}</h3>
                  <p className="text-sm text-gray-600">{project.client}</p>
                </div>
                <div className="flex space-x-2">
                  <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                    project.progress === 100 ? 'bg-green-100 text-green-800' :
                    project.progress > 0 ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {project.progress === 100 ? 'Completed' : 'In Progress'}
                  </span>
                  <button onClick={() => handleEditProjectClick(project)} className="text-gray-500 hover:text-blue-600">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zm-3.646 3.646l-6 6V17h5.364l6-6-2.828-2.828z" />
                    </svg>
                  </button>
                  <button onClick={() => handleDeleteProjectClick(project)} className="text-gray-500 hover:text-red-600">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  </button>
                </div>
              </div>
              <div className="text-sm text-gray-700 flex-grow mb-4">
                <p className="mb-1"><strong>Dates:</strong> {project.startDate} - {project.endDate}</p>
                <p className="mb-1"><strong>Progress:</strong> {project.progress}%</p>
                <div className="w-full bg-gray-200 rounded-full h-2.5 mt-1">
                  <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${project.progress}%` }}></div>
                </div>
                <p className="mt-2 text-gray-600">{project.description}</p>
              </div>

              <div className="mt-auto pt-4 border-t border-gray-100">
                <h4 className="text-md font-semibold text-gray-800 mb-2">Tasks</h4>
                {project.tasks && project.tasks.length > 0 ? (
                  <ul>
                    {project.tasks.map(task => (
                      <li key={task.id} className="flex items-center justify-between py-1 text-sm text-gray-700">
                        <label className="flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={task.completed}
                            onChange={() => handleToggleTask(project.id, task.id)}
                            className="form-checkbox h-4 w-4 text-blue-600 rounded"
                          />
                          <span className={`ml-2 ${task.completed ? 'line-through text-gray-500' : ''}`}>
                            {task.name}
                          </span>
                        </label>
                        <button onClick={() => handleDeleteTask(project.id, task.id)} className="text-gray-400 hover:text-red-600 ml-2">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-500 text-xs">No tasks for this project.</p>
                )}
                <AddTaskForm projectId={project.id} onAddTask={handleAddTask} />
              </div>
            </div>
          ))
        ) : (
          <p className="text-gray-500 text-center col-span-full py-8">No projects found. Add a new project to get started!</p>
        )}
      </div>

      <ProjectForm
        show={showAddEditProjectModal}
        onClose={() => setShowAddEditProjectModal(false)}
        project={currentProject}
        addProject={addProject}
        updateProject={updateProject}
      />

      <CustomModal
        show={showDeleteConfirm}
        message={`Are you sure you want to delete project "${projectToDelete?.name}"?`}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </div>
  );
};

const ProjectForm = ({ show, onClose, project, addProject, updateProject }) => {
  const [formData, setFormData] = useState({
    name: '',
    client: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    progress: 0,
    description: '',
    tasks: [] // tasks will be managed separately or initialized empty
  });

  useEffect(() => {
    if (project) {
      setFormData({
        name: project.name || '',
        client: project.client || '',
        startDate: project.startDate || new Date().toISOString().split('T')[0],
        endDate: project.endDate || new Date().toISOString().split('T')[0],
        progress: project.progress || 0,
        description: project.description || '',
        tasks: project.tasks || []
      });
    } else {
      setFormData({
        name: '',
        client: '',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        progress: 0,
        description: '',
        tasks: []
      });
    }
  }, [project, show]);

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (project) {
      await updateProject(project.id, formData);
    } else {
      await addProject(formData);
    }
    onClose();
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">{project ? 'Edit Project' : 'Add New Project'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="projectName" className="block text-gray-700 text-sm font-bold mb-2">Project Name</label>
            <input
              type="text"
              id="projectName"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div className="mb-4">
            <label htmlFor="clientName" className="block text-gray-700 text-sm font-bold mb-2">Client</label>
            <input
              type="text"
              id="clientName"
              name="client"
              value={formData.client}
              onChange={handleChange}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="mb-4">
            <label htmlFor="startDate" className="block text-gray-700 text-sm font-bold mb-2">Start Date</label>
            <input
              type="date"
              id="startDate"
              name="startDate"
              value={formData.startDate}
              onChange={handleChange}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="mb-4">
            <label htmlFor="endDate" className="block text-gray-700 text-sm font-bold mb-2">End Date</label>
            <input
              type="date"
              id="endDate"
              name="endDate"
              value={formData.endDate}
              onChange={handleChange}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="mb-4">
            <label htmlFor="progress" className="block text-gray-700 text-sm font-bold mb-2">Progress (%)</label>
            <input
              type="range"
              id="progress"
              name="progress"
              value={formData.progress}
              onChange={handleChange}
              min="0"
              max="100"
              step="5"
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer range-lg"
            />
            <span className="text-sm text-gray-600">{formData.progress}%</span>
          </div>
          <div className="mb-6">
            <label htmlFor="description" className="block text-gray-700 text-sm font-bold mb-2">Description</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows="3"
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
            ></textarea>
          </div>
          <div className="flex items-center justify-between">
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition duration-200 ease-in-out"
            >
              {project ? 'Update Project' : 'Add Project'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-opacity-50 transition duration-200 ease-in-out"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const AddTaskForm = ({ projectId, onAddTask }) => {
  const [taskName, setTaskName] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (taskName.trim()) {
      onAddTask(projectId, taskName.trim());
      setTaskName('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex mt-4">
      <input
        type="text"
        placeholder="Add new task..."
        value={taskName}
        onChange={(e) => setTaskName(e.target.value)}
        className="flex-grow p-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
      />
      <button
        type="submit"
        className="px-4 py-2 bg-blue-600 text-white rounded-r-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 text-sm"
      >
        Add
      </button>
    </form>
  );
};


const Settings = () => {
  const { userId, db, appId } = useAppContext(); // Destructure appId from context
  const [profile, setProfile] = useState({
    firstName: '',
    lastName: '',
    email: '',
    company: '',
    bio: ''
  });
  const [notifications, setNotifications] = useState({
    emailNotifications: false,
    dealReminders: false,
    taskNotifications: false,
    weeklyReports: false
  });
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingNotifications, setLoadingNotifications] = useState(true);
  const [showSaveProfileSuccess, setShowSaveProfileSuccess] = useState(false);
  const [showSaveNotificationsSuccess, setShowSaveNotificationsSuccess] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      if (userId && db && appId) { // Ensure appId is available
        // Fetch Profile
        try {
          setLoadingProfile(true);
          const profileDocRef = doc(db, `artifacts/${appId}/users/${userId}/settings`, 'profile');
          const profileSnap = await getDoc(profileDocRef);
          if (profileSnap.exists()) {
            setProfile(profileSnap.data());
          }
        } catch (error) {
          console.error("Error fetching profile settings:", error);
        } finally {
          setLoadingProfile(false);
        }

        // Fetch Notifications
        try {
          setLoadingNotifications(true);
          const notificationsDocRef = doc(db, `artifacts/${appId}/users/${userId}/settings`, 'notifications');
          const notificationsSnap = await getDoc(notificationsDocRef);
          if (notificationsSnap.exists()) {
            setNotifications(notificationsSnap.data());
          }
        } catch (error) {
          console.error("Error fetching notification settings:", error);
        } finally {
          setLoadingNotifications(false);
        }
      }
    };

    fetchSettings();
  }, [userId, db, appId]); // Add appId to dependency array

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfile(prev => ({ ...prev, [name]: value }));
  };

  const handleNotificationChange = (e) => {
    const { name, checked } = e.target;
    setNotifications(prev => ({ ...prev, [name]: checked }));
  };

  const saveProfile = async () => {
    if (userId && db && appId) { // Ensure appId is available
      try {
        const profileDocRef = doc(db, `artifacts/${appId}/users/${userId}/settings`, 'profile');
        await setDoc(profileDocRef, profile, { merge: true });
        setShowSaveProfileSuccess(true);
        setTimeout(() => setShowSaveProfileSuccess(false), 3000); // Hide after 3 seconds
        console.log("Profile settings saved!");
      } catch (error) {
        console.error("Error saving profile settings:", error);
      }
    }
  };

  const saveNotifications = async () => {
    if (userId && db && appId) { // Ensure appId is available
      try {
        const notificationsDocRef = doc(db, `artifacts/${appId}/users/${userId}/settings`, 'notifications');
        await setDoc(notificationsDocRef, notifications, { merge: true });
        setShowSaveNotificationsSuccess(true);
        setTimeout(() => setShowSaveNotificationsSuccess(false), 3000); // Hide after 3 seconds
        console.log("Notification settings saved!");
      } catch (error) {
        console.error("Error saving notification settings:", error);
      }
    }
  };

  if (loadingProfile || loadingNotifications) {
    return <div className="p-4 text-center text-gray-600">Loading settings...</div>;
  }

  return (
    <div className="p-4 md:p-8 bg-gray-50 min-h-screen">
      <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">Settings</h1>
      <p className="text-gray-600 mb-6">Manage your CRM preferences and configuration.</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profile Settings */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h10a2 2 0 002-2v-5m-7-5a2 2 0 11-4 0 2 2 0 014 0zm0 0V9m0-3h.01M16 17a2 2 0 01-2 2h-2m2-2V7m2 10a2 2 0 002-2v-4m-2 4a2 2 0 01-2 2h-2m2-2V7m2 10a2 2 0 002-2v-4m-2 4a2 2 0 01-2 2h-2m2-2V7" />
            </svg>
            Profile Settings
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div>
              <label htmlFor="firstName" className="block text-gray-700 text-sm font-bold mb-2">First Name</label>
              <input
                type="text"
                id="firstName"
                name="firstName"
                value={profile.firstName}
                onChange={handleProfileChange}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label htmlFor="lastName" className="block text-gray-700 text-sm font-bold mb-2">Last Name</label>
              <input
                type="text"
                id="lastName"
                name="lastName"
                value={profile.lastName}
                onChange={handleProfileChange}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="mb-4">
            <label htmlFor="email" className="block text-gray-700 text-sm font-bold mb-2">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              value={profile.email}
              onChange={handleProfileChange}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="mb-4">
            <label htmlFor="company" className="block text-gray-700 text-sm font-bold mb-2">Company</label>
            <input
              type="text"
              id="company"
              name="company"
              value={profile.company}
              onChange={handleProfileChange}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="mb-6">
            <label htmlFor="bio" className="block text-gray-700 text-sm font-bold mb-2">Bio</label>
            <textarea
              id="bio"
              name="bio"
              value={profile.bio}
              onChange={handleProfileChange}
              rows="3"
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
            ></textarea>
          </div>
          <button
            onClick={saveProfile}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition duration-200 ease-in-out"
          >
            Save Profile
          </button>
          {showSaveProfileSuccess && <p className="text-green-600 text-sm mt-2">Profile saved successfully!</p>}
        </div>

        {/* Notifications Settings */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            Notifications
          </h2>
          <div className="space-y-4 mb-6">
            <div className="flex items-center justify-between">
              <label htmlFor="emailNotifications" className="text-gray-700">Email Notifications</label>
              <input
                type="checkbox"
                id="emailNotifications"
                name="emailNotifications"
                checked={notifications.emailNotifications}
                onChange={handleNotificationChange}
                className="form-checkbox h-5 w-5 text-blue-600 rounded"
              />
            </div>
            <div className="flex items-center justify-between">
              <label htmlFor="dealReminders" className="text-gray-700">Deal Reminders</label>
              <input
                type="checkbox"
                id="dealReminders"
                name="dealReminders"
                checked={notifications.dealReminders}
                onChange={handleNotificationChange}
                className="form-checkbox h-5 w-5 text-blue-600 rounded"
              />
            </div>
            <div className="flex items-center justify-between">
              <label htmlFor="taskNotifications" className="text-gray-700">Task Notifications</label>
              <input
                type="checkbox"
                id="taskNotifications"
                name="taskNotifications"
                checked={notifications.taskNotifications}
                onChange={handleNotificationChange}
                className="form-checkbox h-5 w-5 text-blue-600 rounded"
              />
            </div>
            <div className="flex items-center justify-between">
              <label htmlFor="weeklyReports" className="text-gray-700">Weekly Reports</label>
              <input
                type="checkbox"
                id="weeklyReports"
                name="weeklyReports"
                checked={notifications.weeklyReports}
                onChange={handleNotificationChange}
                className="form-checkbox h-5 w-5 text-blue-600 rounded"
              />
            </div>
          </div>
          <button
            onClick={saveNotifications}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition duration-200 ease-in-out"
          >
            Save Preferences
          </button>
          {showSaveNotificationsSuccess && <p className="text-green-600 text-sm mt-2">Notifications saved successfully!</p>}
        </div>
      </div>
    </div>
  );
};

// AI Chatbot Component
const AIChatbot = () => {
  const { addContact, updateDeal, addProject, updateProject, contacts, deals, projects, loading } = useAppContext();
  const [chatHistory, setChatHistory] = useState([]);
  const [userInput, setUserInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [currentAction, setCurrentAction] = useState(null); // { type: 'addContact', data: {}, step: 'confirm' }
  const messagesEndRef = useRef(null);

  const pipelineStages = [
    'Initial Contact',
    'First Meeting Scheduled',
    'First Meeting Held',
    'Proposal Sent',
    'Proposal Accepted (Won)'
  ];

  // Scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  useEffect(() => {
    if (chatHistory.length === 0) {
      addBotMessage("Hello! I'm your CRM assistant. How can I help you today? You can ask me to add a contact, update a deal, or manage a project.");
    }
  }, [chatHistory]);

  const addBotMessage = (text) => {
    setChatHistory((prev) => [...prev, { role: 'model', text }]);
  };

  const addUserMessage = (text) => {
    setChatHistory((prev) => [...prev, { role: 'user', text }]);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!userInput.trim()) return;

    const userMessage = userInput.trim();
    addUserMessage(userMessage);
    setUserInput('');
    setIsTyping(true);

    if (currentAction && currentAction.step === 'confirm') {
      if (userMessage.toLowerCase() === 'yes' || userMessage.toLowerCase() === 'y') {
        await executeAction(currentAction);
        setCurrentAction(null);
      } else if (userMessage.toLowerCase() === 'no' || userMessage.toLowerCase() === 'n') {
        addBotMessage("Okay, I've cancelled the operation. What else can I help you with?");
        setCurrentAction(null);
      } else {
        addBotMessage("Please respond with 'yes' or 'no'.");
      }
      setIsTyping(false);
      return;
    }

    // Prepare chat history for Gemini API
    const chatHistoryForGemini = chatHistory.map(msg => ({
      role: msg.role,
      parts: [{ text: msg.text }]
    }));
    chatHistoryForGemini.push({ role: "user", parts: [{ text: userMessage }] });

    // Define the schema for structured output
    const responseSchema = {
      type: "OBJECT",
      properties: {
        intent: {
          type: "STRING",
          enum: ["add_contact", "update_deal", "add_project", "add_task_to_project", "none"]
        },
        data: {
          type: "OBJECT",
          properties: {
            // Contact properties
            name: { type: "STRING" },
            company: { type: "STRING" },
            title: { type: "STRING" },
            email: { type: "STRING" },
            phone: { type: "STRING" },
            notes: { type: "STRING" },
            lastContacted: { type: "STRING", format: "date" },
            // Deal properties
            dealName: { type: "STRING" },
            dealCompany: { type: "STRING" },
            value: { type: "NUMBER" },
            stage: { type: "STRING", enum: pipelineStages },
            expectedCloseDate: { type: "STRING", format: "date" },
            probability: { type: "NUMBER" },
            // Project properties
            projectName: { type: "STRING" },
            projectClient: { type: "STRING" },
            startDate: { type: "STRING", format: "date" },
            endDate: { type: "STRING", format: "date" },
            progress: { type: "NUMBER" },
            description: { type: "STRING" },
            // Task properties
            projectId: { type: "STRING" }, // For adding tasks to existing projects
            taskName: { type: "STRING" }
          },
          required: [] // Will be dynamically populated by AI
        },
        missingFields: {
          type: "ARRAY",
          items: { type: "STRING" }
        },
        confirmationMessage: {
          type: "STRING"
        }
      }
    };

    const prompt = `You are a CRM assistant. Your goal is to help the user manage their contacts, sales pipeline, and projects.
    When the user asks to perform an action, identify their intent and extract all necessary information.
    If information is missing, ask follow-up questions to gather it.
    Once all information for an action is gathered, provide a confirmation message to the user, listing all the details you've collected, and ask them to confirm with 'yes' or 'no'.
    If the user confirms, the 'confirmationMessage' should be empty, and the 'intent' should be the action to perform.
    If the user cancels, the 'intent' should be 'none'.

    Available pipeline stages are: ${pipelineStages.join(', ')}.
    Available contacts: ${contacts.map(c => c.name).join(', ') || 'None'}.
    Available deals: ${deals.map(d => d.name).join(', ') || 'None'}.
    Available projects: ${projects.map(p => p.name).join(', ') || 'None'}.

    Examples of user requests and expected AI responses (structured JSON):

    User: "Add a new contact named John Doe from Acme Corp, email john@acme.com"
    AI (JSON): { "intent": "add_contact", "data": { "name": "John Doe", "company": "Acme Corp", "email": "john@acme.com" }, "missingFields": ["title", "phone", "notes", "lastContacted"], "confirmationMessage": "I have the following details for a new contact: Name: John Doe, Company: Acme Corp, Email: john@acme.com. Is this correct?" }

    User: "Update the deal 'Acme Project' to 'Proposal Accepted (Won)'"
    AI (JSON): { "intent": "update_deal", "data": { "dealName": "Acme Project", "stage": "Proposal Accepted (Won)" }, "missingFields": [], "confirmationMessage": "I will update the deal 'Acme Project' to 'Proposal Accepted (Won)'. Confirm?" }

    User: "Create a new project for Google called 'Website Redesign', starting tomorrow and ending in 3 months."
    AI (JSON): { "intent": "add_project", "data": { "client": "Google", "name": "Website Redesign", "startDate": "2024-07-17", "endDate": "2024-10-17" }, "missingFields": ["progress", "description"], "confirmationMessage": "I will create a project named 'Website Redesign' for Google, starting tomorrow and ending in 3 months. Is this correct?" }

    User: "Add a task 'Design wireframes' to project 'Website Redesign'"
    AI (JSON): { "intent": "add_task_to_project", "data": { "projectName": "Website Redesign", "taskName": "Design wireframes" }, "missingFields": [], "confirmationMessage": "I will add 'Design wireframes' to the 'Website Redesign' project. Confirm?" }

    User: "Yes" (after a confirmation message)
    AI (JSON): { "intent": "add_contact", "data": { "name": "John Doe", "company": "Acme Corp", "email": "john@acme.com", "title": "Sales Manager", "phone": "555-1234", "notes": "Follow up next week", "lastContacted": "2024-07-16" }, "missingFields": [], "confirmationMessage": "" }

    User: "No" (after a confirmation message)
    AI (JSON): { "intent": "none", "data": {}, "missingFields": [], "confirmationMessage": "" }

    If you cannot determine the intent or the request is unclear, set intent to "none" and ask for clarification.
    Always provide a 'confirmationMessage' when you have enough information to perform an action.
    Always include 'missingFields' if there are any.
    Dates should be in YYYY-MM-DD format.
    When updating a deal or project, ensure the 'dealName' or 'projectName' matches an existing one. If not, ask the user to clarify.
    `;

    try {
      const payload = {
        contents: chatHistoryForGemini,
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: responseSchema
        }
      };

      const apiKey = ""; // If you want to use models other than gemini-2.0-flash or imagen-3.0-generate-002, provide an API key here. Otherwise, leave this as-is.
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      if (result.candidates && result.candidates.length > 0 &&
        result.candidates[0].content && result.candidates[0].content.parts &&
        result.candidates[0].content.parts.length > 0) {
        const jsonText = result.candidates[0].content.parts[0].text;
        const parsedResponse = JSON.parse(jsonText);

        if (parsedResponse.confirmationMessage) {
          addBotMessage(parsedResponse.confirmationMessage);
          setCurrentAction({
            type: parsedResponse.intent,
            data: parsedResponse.data,
            step: 'confirm'
          });
        } else if (parsedResponse.missingFields && parsedResponse.missingFields.length > 0) {
          const missing = parsedResponse.missingFields.join(', ');
          addBotMessage(`I need more information. Please provide the following: ${missing}.`);
          setCurrentAction({
            type: parsedResponse.intent,
            data: parsedResponse.data,
            step: 'gathering'
          });
        } else if (parsedResponse.intent !== 'none' && Object.keys(parsedResponse.data).length > 0) {
          // If no confirmation message but all fields are present, assume ready for execution
          setCurrentAction({
            type: parsedResponse.intent,
            data: parsedResponse.data,
            step: 'confirm' // Force confirmation even if AI didn't explicitly ask
          });
          addBotMessage(`I have gathered the information and am ready to proceed. Please confirm with 'yes' or 'no'. Details: ${JSON.stringify(parsedResponse.data)}`);
        } else {
          addBotMessage("I'm not sure how to help with that. Could you please rephrase or tell me what you'd like to do (e.g., 'add contact', 'update deal', 'add project')?");
        }

      } else {
        addBotMessage("I apologize, I couldn't process that request. Please try again.");
      }
    } catch (error) {
      console.error("Error communicating with AI:", error);
      addBotMessage("I'm having trouble connecting to the AI. Please try again later.");
    } finally {
      setIsTyping(false);
    }
  };

  const executeAction = async (action) => {
    setIsTyping(true);
    try {
      if (action.type === 'add_contact') {
        await addContact({
          name: action.data.name || '',
          company: action.data.company || '',
          title: action.data.title || '',
          email: action.data.email || '',
          phone: action.data.phone || '',
          notes: action.data.notes || '',
          lastContacted: action.data.lastContacted || new Date().toISOString().split('T')[0]
        });
        addBotMessage(`Contact "${action.data.name}" added successfully!`);
      } else if (action.type === 'update_deal') {
        const targetDeal = deals.find(d => d.name.toLowerCase() === action.data.dealName.toLowerCase());
        if (targetDeal) {
          await updateDeal(targetDeal.id, {
            stage: action.data.stage || targetDeal.stage,
            value: action.data.value || targetDeal.value,
            expectedCloseDate: action.data.expectedCloseDate || targetDeal.expectedCloseDate,
            probability: action.data.probability || targetDeal.probability,
            notes: action.data.notes || targetDeal.notes
          });
          addBotMessage(`Deal "${action.data.dealName}" updated successfully!`);
        } else {
          addBotMessage(`Deal "${action.data.dealName}" not found. Please specify an existing deal.`);
        }
      } else if (action.type === 'add_project') {
        await addProject({
          name: action.data.projectName || '',
          client: action.data.projectClient || '',
          startDate: action.data.startDate || new Date().toISOString().split('T')[0],
          endDate: action.data.endDate || new Date().toISOString().split('T')[0],
          progress: action.data.progress || 0,
          description: action.data.description || '',
          tasks: []
        });
        addBotMessage(`Project "${action.data.projectName}" added successfully!`);
      } else if (action.type === 'add_task_to_project') {
        const targetProject = projects.find(p => p.name.toLowerCase() === action.data.projectName.toLowerCase());
        if (targetProject) {
          const updatedTasks = [...(targetProject.tasks || []), { id: crypto.randomUUID(), name: action.data.taskName, completed: false }];
          await updateProject(targetProject.id, { tasks: updatedTasks });
          addBotMessage(`Task "${action.data.taskName}" added to project "${action.data.projectName}" successfully!`);
        } else {
          addBotMessage(`Project "${action.data.projectName}" not found. Please specify an existing project.`);
        }
      }
    } catch (error) {
      console.error("Error executing action:", error);
      addBotMessage("An error occurred while trying to save the information. Please try again.");
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 p-4 md:p-8">
      <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">AI Chatbot</h1>
      <p className="text-gray-600 mb-6">Chat with your CRM assistant to quickly add and update data.</p>

      <div className="flex-grow bg-white rounded-lg shadow-md border border-gray-200 flex flex-col overflow-hidden">
        <div className="flex-grow p-4 overflow-y-auto space-y-4">
          {chatHistory.map((msg, index) => (
            <div
              key={index}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-xs md:max-w-md p-3 rounded-lg shadow-sm ${
                msg.role === 'user'
                  ? 'bg-blue-500 text-white rounded-br-none'
                  : 'bg-gray-200 text-gray-800 rounded-bl-none'
              }`}>
                {msg.text}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div className="max-w-xs md:max-w-md p-3 rounded-lg shadow-sm bg-gray-200 text-gray-800 rounded-bl-none">
                <span className="animate-pulse">Typing...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200 bg-white">
          <div className="flex items-center">
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="Type your message..."
              className="flex-grow p-3 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isTyping}
            />
            <button
              type="submit"
              className="px-6 py-3 bg-blue-600 text-white rounded-r-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition duration-200 ease-in-out"
              disabled={isTyping}
            >
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


// Main App Component
const App = () => {
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);
  const [appId, setAppId] = useState(null); // State to hold appId
  const [currentPage, setCurrentPage] = useState('dashboard'); // Default page
  const [contacts, setContacts] = useState([]);
  const [deals, setDeals] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  // Firebase Initialization and Authentication
  useEffect(() => {
    const currentAppId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    setAppId(currentAppId); // Set appId in state

    const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};

    const app = initializeApp(firebaseConfig);
    const firestore = getFirestore(app);
    const firebaseAuth = getAuth(app);

    setDb(firestore);
    setAuth(firebaseAuth);

    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      if (user) {
        setUserId(user.uid);
      } else {
        // Sign in anonymously if no user is authenticated
        try {
          if (typeof __initial_auth_token !== 'undefined') {
            await signInWithCustomToken(firebaseAuth, __initial_auth_token);
          } else {
            await signInAnonymously(firebaseAuth);
          }
        } catch (error) {
          console.error("Error signing in:", error);
          // Fallback to a random UUID if anonymous sign-in fails (e.g., no internet)
          setUserId(crypto.randomUUID());
        }
      }
      setLoading(false); // Auth state is ready
    });

    return () => unsubscribe(); // Clean up auth listener
  }, []);

  // Firestore Data Listeners
  useEffect(() => {
    if (db && userId && appId) { // Ensure appId is available here
      setLoading(true); // Start loading when userId is available

      // Contacts Listener
      const contactsColRef = collection(db, `artifacts/${appId}/users/${userId}/contacts`);
      const unsubscribeContacts = onSnapshot(contactsColRef, (snapshot) => {
        const contactsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setContacts(contactsData);
        setLoading(false);
      }, (error) => {
        console.error("Error fetching contacts:", error);
        setLoading(false);
      });

      // Deals Listener
      const dealsColRef = collection(db, `artifacts/${appId}/users/${userId}/deals`);
      const unsubscribeDeals = onSnapshot(dealsColRef, (snapshot) => {
        const dealsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setDeals(dealsData);
        setLoading(false);
      }, (error) => {
        console.error("Error fetching deals:", error);
        setLoading(false);
      });

      // Projects Listener
      const projectsColRef = collection(db, `artifacts/${appId}/users/${userId}/projects`);
      const unsubscribeProjects = onSnapshot(projectsColRef, (snapshot) => {
        const projectsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setProjects(projectsData);
        setLoading(false);
      }, (error) => {
        console.error("Error fetching projects:", error);
        setLoading(false);
      });

      return () => {
        unsubscribeContacts();
        unsubscribeDeals();
        unsubscribeProjects();
      };
    }
  }, [db, userId, appId]); // Add appId to dependency array

  // CRUD Operations for Contacts
  const addContact = async (contactData) => {
    if (!db || !userId || !appId) return; // Ensure appId is available
    try {
      await addDoc(collection(db, `artifacts/${appId}/users/${userId}/contacts`), contactData);
      console.log("Contact added successfully!");
    } catch (e) {
      console.error("Error adding contact: ", e);
    }
  };

  const updateContact = async (id, contactData) => {
    if (!db || !userId || !appId) return; // Ensure appId is available
    try {
      const contactDocRef = doc(db, `artifacts/${appId}/users/${userId}/contacts`, id);
      await updateDoc(contactDocRef, contactData);
      console.log("Contact updated successfully!");
    } catch (e) {
      console.error("Error updating contact: ", e);
    }
  };

  const deleteContact = async (id) => {
    if (!db || !userId || !appId) return; // Ensure appId is available
    try {
      await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/contacts`, id));
      console.log("Contact deleted successfully!");
    } catch (e) {
      console.error("Error deleting contact: ", e);
    }
  };

  // CRUD Operations for Deals
  const addDeal = async (dealData) => {
    if (!db || !userId || !appId) return; // Ensure appId is available
    try {
      await addDoc(collection(db, `artifacts/${appId}/users/${userId}/deals`), dealData);
      console.log("Deal added successfully!");
    } catch (e) {
      console.error("Error adding deal: ", e);
    }
  };

  const updateDeal = async (id, dealData) => {
    if (!db || !userId || !appId) return; // Ensure appId is available
    try {
      const dealDocRef = doc(db, `artifacts/${appId}/users/${userId}/deals`, id);
      await updateDoc(dealDocRef, dealData);
      console.log("Deal updated successfully!");
    } catch (e) {
      console.error("Error updating deal: ", e);
    }
  };

  const deleteDeal = async (id) => {
    if (!db || !userId || !appId) return; // Ensure appId is available
    try {
      await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/deals`, id));
      console.log("Deal deleted successfully!");
    } catch (e) {
      console.error("Error deleting deal: ", e);
    }
  };

  // CRUD Operations for Projects
  const addProject = async (projectData) => {
    if (!db || !userId || !appId) return; // Ensure appId is available
    try {
      await addDoc(collection(db, `artifacts/${appId}/users/${userId}/projects`), projectData);
      console.log("Project added successfully!");
    } catch (e) {
      console.error("Error adding project: ", e);
    }
  };

  const updateProject = async (id, projectData) => {
    if (!db || !userId || !appId) return; // Ensure appId is available
    try {
      const projectDocRef = doc(db, `artifacts/${appId}/users/${userId}/projects`, id);
      await updateDoc(projectDocRef, projectData);
      console.log("Project updated successfully!");
    } catch (e) {
      console.error("Error updating project: ", e);
    }
  };

  const deleteProject = async (id) => {
    if (!db || !userId || !appId) return; // Ensure appId is available
    try {
      await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/projects`, id));
      console.log("Project deleted successfully!");
    } catch (e) {
      console.error("Error deleting project: ", e);
    }
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'contacts':
        return <Contacts />;
      case 'pipeline':
        return <Pipeline />;
      case 'projects':
        return <Projects />;
      case 'settings':
        return <Settings />;
      case 'chatbot':
        return <AIChatbot />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <AppContext.Provider value={{
      db, auth, userId, loading, appId, // Pass appId to context
      contacts, addContact, updateContact, deleteContact,
      deals, addDeal, updateDeal, deleteDeal,
      projects, addProject, updateProject, deleteProject
    }}>
      <div className="flex flex-col md:flex-row min-h-screen bg-gray-100 font-sans antialiased">
        {/* Sidebar Navigation */}
        <aside className="w-full md:w-64 bg-white shadow-lg md:shadow-none p-4 md:p-6 flex flex-col">
          <div className="flex items-center mb-8">
            <img src="https://placehold.co/40x40/007bff/ffffff?text=AI" alt="CRM Logo" className="rounded-full mr-3" />
            <div>
              <h2 className="text-xl font-bold text-gray-800">AI Consulting CRM</h2>
              <p className="text-sm text-gray-500">Business Growth Solutions</p>
            </div>
          </div>

          <nav className="flex-grow">
            <ul className="space-y-2">
              <li>
                <button
                  onClick={() => setCurrentPage('dashboard')}
                  className={`flex items-center w-full px-4 py-2 rounded-md transition-colors duration-200
                    ${currentPage === 'dashboard' ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-gray-700 hover:bg-gray-100 hover:text-blue-600'}
                  `}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  Dashboard
                </button>
              </li>
              <li>
                <button
                  onClick={() => setCurrentPage('contacts')}
                  className={`flex items-center w-full px-4 py-2 rounded-md transition-colors duration-200
                    ${currentPage === 'contacts' ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-gray-700 hover:bg-gray-100 hover:text-blue-600'}
                  `}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H2v-2a3 3 0 015.356-1.857M17 20v-2c0-.653-.16-1.269-.432-1.815m0 0A3.003 3.003 0 0015 13a3 3 0 00-3-3h-1.586a1 1 0 01-.707-.293l-1.121-1.121A4 4 0 007.05 4.05L5.636 2.636M17 20l-2.144-2.144m0 0A3.003 3.003 0 0015 13a3 3 0 00-3-3h-1.586a1 1 0 01-.707-.293l-1.121-1.121A4 4 0 007.05 4.05L5.636 2.636" />
                  </svg>
                  Contacts
                </button>
              </li>
              <li>
                <button
                  onClick={() => setCurrentPage('pipeline')}
                  className={`flex items-center w-full px-4 py-2 rounded-md transition-colors duration-200
                    ${currentPage === 'pipeline' ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-gray-700 hover:bg-gray-100 hover:text-blue-600'}
                  `}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Pipeline
                </button>
              </li>
              <li>
                <button
                  onClick={() => setCurrentPage('projects')}
                  className={`flex items-center w-full px-4 py-2 rounded-md transition-colors duration-200
                    ${currentPage === 'projects' ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-gray-700 hover:bg-gray-100 hover:text-blue-600'}
                  `}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                  Projects
                </button>
              </li>
              <li>
                <button
                  onClick={() => setCurrentPage('chatbot')}
                  className={`flex items-center w-full px-4 py-2 rounded-md transition-colors duration-200
                    ${currentPage === 'chatbot' ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-gray-700 hover:bg-gray-100 hover:text-blue-600'}
                  `}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  AI Chatbot
                </button>
              </li>
              <li>
                <button
                  onClick={() => setCurrentPage('settings')}
                  className={`flex items-center w-full px-4 py-2 rounded-md transition-colors duration-200
                    ${currentPage === 'settings' ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-gray-700 hover:bg-gray-100 hover:text-blue-600'}
                  `}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Settings
                </button>
              </li>
            </ul>
          </nav>

          {userId && (
            <div className="mt-8 p-4 bg-gray-50 rounded-lg text-sm text-gray-600">
              <p>User ID:</p>
              <p className="font-mono break-all">{userId}</p>
            </div>
          )}
        </aside>

        {/* Main Content Area */}
        <main className="flex-grow">
          {renderPage()}
        </main>
      </div>
    </AppContext.Provider>
  );
};

export default App;

