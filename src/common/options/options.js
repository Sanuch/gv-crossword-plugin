function renderList(services) {
  console.log('🎛️ Rendering services list with', services.length, 'services');
  const list = document.getElementById('serviceList');
  list.innerHTML = '';
  
  services.forEach((svc, idx) => {
    console.log(`➕ Adding service ${idx}: ${svc.name} (${svc.endpoint})`);
    const li = document.createElement('li');
    li.textContent = `${svc.name}: ${svc.endpoint}`;
    const del = document.createElement('button');
    del.textContent = 'Delete';
    del.onclick = async () => {
      console.log(`🗑️ Deleting service ${idx}: ${svc.name}`);
      services.splice(idx, 1);
      await chrome.storage.sync.set({ services });
      console.log('💾 Services updated in storage:', services);
      renderList(services);
    };
    li.appendChild(del);
    list.appendChild(li);
  });
  
  console.log('✅ Services list rendered successfully');
}

document.getElementById('addBtn').addEventListener('click', async () => {
  console.log('➕ Add service button clicked');
  
  try {
    const name = prompt('Service name:');
    const endpoint = prompt('Service endpoint URL:');
    
    console.log('📝 User input - Name:', name, 'Endpoint:', endpoint);
    
    if (!name || !endpoint) {
      console.log('❌ Missing name or endpoint, operation cancelled');
      return;
    }
    
    console.log('🔧 Loading existing services...');
    const data = await chrome.storage.sync.get('services');
    const services = data.services || [];
    console.log('📋 Current services:', services);
    
    const newService = { name, endpoint };
    services.push(newService);
    console.log('➕ Adding new service:', newService);
    
    await chrome.storage.sync.set({ services });
    console.log('💾 Services saved to storage:', services);
    
    renderList(services);
    console.log('✅ Service added successfully');
  } catch (error) {
    console.error('❌ Error adding service:', error);
  }
});

(async () => {
  console.log('🚀 Options page loaded, initializing...');
  
  try {
    console.log('🔧 Loading services from storage...');
    const data = await chrome.storage.sync.get('services');
    const services = data.services || [];
    console.log('📋 Loaded services:', services);
    
    renderList(services);
    console.log('✅ Options page initialization complete');
  } catch (error) {
    console.error('❌ Error during options initialization:', error);
  }
})();