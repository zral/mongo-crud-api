/**
 * Leader Election Service
 * Manages leader election for services that need single-instance coordination
 */

const EventEmitter = require('events');
const DistributedLock = require('./distributedLock');
const config = require('../config');

class LeaderElection extends EventEmitter {
  constructor(serviceName = 'default') {
    super();
    this.serviceName = serviceName;
    this.distributedLock = new DistributedLock();
    this.isLeader = false;
    this.leadershipLock = null;
    this.leadershipInterval = null;
    this.electionInterval = null;
    this.isShuttingDown = false;
    this.leadershipStartTime = null;
    
    this.setupGracefulShutdown();
  }

  setupGracefulShutdown() {
    const gracefulShutdown = async (signal) => {
      if (this.isShuttingDown) return;
      
      console.log(`📡 Received ${signal}, initiating graceful shutdown for ${this.serviceName} leader election...`);
      
      this.isShuttingDown = true;
      
      if (this.isLeader) {
        await this.resignLeadership();
      }
      
      // Clear intervals
      if (this.leadershipInterval) {
        clearInterval(this.leadershipInterval);
      }
      if (this.electionInterval) {
        clearInterval(this.electionInterval);
      }
      
      await this.distributedLock.disconnect();
      console.log(`📴 ${this.serviceName} leader election shutdown complete`);
    };

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
    process.on('SIGUSR2', gracefulShutdown); // nodemon restart
  }

  /**
   * Start the leader election process
   */
  async startElection() {
    if (this.isShuttingDown) return;
    
    console.log(`🗳️  Starting leader election for ${this.serviceName}...`);
    
    // Initial election attempt
    await this.attemptLeadership();
    
    // Keep trying to become leader if not currently leader
    this.electionInterval = setInterval(async () => {
      if (!this.isLeader && !this.isShuttingDown) {
        await this.attemptLeadership();
      }
    }, config.scaling.leadershipRenewalInterval || 10000);
  }

  /**
   * Attempt to acquire leadership
   */
  async attemptLeadership() {
    if (this.isLeader || this.isShuttingDown) return false;
    
    const leaderKey = `leader:${this.serviceName}`;
    const lockValue = `${config.cluster.instanceId}:${Date.now()}`;
    
    try {
      const lock = await this.distributedLock.acquireLock(
        leaderKey, 
        config.scaling.leadershipRenewalInterval * 2 || 60000
      );
      
      if (lock) {
        this.isLeader = true;
        this.leadershipLock = lock;
        this.leadershipStartTime = Date.now();
        
        console.log(`👑 Instance ${config.cluster.instanceId} became ${this.serviceName} leader`);
        
        // Start extending leadership
        this.startLeadershipMaintenance();
        
        this.emit('leadershipAcquired', {
          serviceName: this.serviceName,
          instanceId: config.cluster.instanceId,
          timestamp: new Date().toISOString()
        });
        
        return true;
      }
    } catch (error) {
      console.error(`❌ Error attempting leadership for ${this.serviceName}:`, error.message);
    }
    
    return false;
  }

  /**
   * Start maintaining leadership by extending the lock
   */
  startLeadershipMaintenance() {
    if (this.leadershipInterval) {
      clearInterval(this.leadershipInterval);
    }
    
    const renewalInterval = (config.scaling.leadershipRenewalInterval || 30000) / 2;
    
    this.leadershipInterval = setInterval(async () => {
      if (!this.isLeader || this.isShuttingDown) {
        clearInterval(this.leadershipInterval);
        return;
      }
      
      const leaderKey = `leader:${this.serviceName}`;
      const extended = await this.distributedLock.extendLock(
        leaderKey, 
        this.leadershipLock, 
        config.scaling.leadershipRenewalInterval * 2 || 60000
      );
      
      if (!extended) {
        console.log(`⚠️  Failed to extend ${this.serviceName} leadership, stepping down...`);
        await this.handleLeadershipLoss();
      }
    }, renewalInterval);
  }

  /**
   * Resign from leadership gracefully
   */
  async resignLeadership() {
    if (!this.isLeader || !this.leadershipLock) return;

    console.log(`👋 Instance ${config.cluster.instanceId} resigning ${this.serviceName} leadership...`);
    
    try {
      // Stop extending the lock
      if (this.leadershipInterval) {
        clearInterval(this.leadershipInterval);
        this.leadershipInterval = null;
      }

      // Release the leadership lock immediately
      const leaderKey = `leader:${this.serviceName}`;
      await this.distributedLock.releaseLock(leaderKey, this.leadershipLock);
      
      // Mark as no longer leader
      this.isLeader = false;
      this.leadershipLock = null;
      this.leadershipStartTime = null;
      
      // Notify listeners
      this.emit('leadershipResigned', {
        serviceName: this.serviceName,
        instanceId: config.cluster.instanceId,
        timestamp: new Date().toISOString()
      });
      
      console.log(`✅ ${this.serviceName} leadership resigned successfully`);
    } catch (error) {
      console.error(`❌ Error during ${this.serviceName} leadership resignation:`, error.message);
      // Force local state cleanup even if Redis operation failed
      this.handleLeadershipLoss();
    }
  }

  /**
   * Handle unexpected leadership loss
   */
  async handleLeadershipLoss() {
    const wasLeader = this.isLeader;
    
    this.isLeader = false;
    this.leadershipLock = null;
    this.leadershipStartTime = null;
    
    if (this.leadershipInterval) {
      clearInterval(this.leadershipInterval);
      this.leadershipInterval = null;
    }
    
    if (wasLeader) {
      console.log(`💔 Lost ${this.serviceName} leadership unexpectedly`);
      
      this.emit('leadershipLost', {
        serviceName: this.serviceName,
        instanceId: config.cluster.instanceId,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Get current leadership status
   */
  getLeadershipStatus() {
    return {
      serviceName: this.serviceName,
      instanceId: config.cluster.instanceId,
      isLeader: this.isLeader,
      leadershipStartTime: this.leadershipStartTime,
      leadershipDuration: this.leadershipStartTime ? Date.now() - this.leadershipStartTime : null,
      isShuttingDown: this.isShuttingDown
    };
  }

  /**
   * Get information about the current leader
   */
  async getCurrentLeader() {
    try {
      const leaderKey = `leader:${this.serviceName}`;
      const lockInfo = await this.distributedLock.getLockInfo(leaderKey);
      
      if (lockInfo) {
        return {
          serviceName: this.serviceName,
          instanceId: lockInfo.instanceId,
          since: new Date(lockInfo.timestamp),
          ttl: lockInfo.ttl,
          isCurrentInstance: lockInfo.isOwned
        };
      }
      
      return null;
    } catch (error) {
      console.error(`❌ Error getting current ${this.serviceName} leader:`, error.message);
      return null;
    }
  }

  /**
   * Force leadership election (for testing/admin purposes)
   */
  async forceElection() {
    if (this.isShuttingDown) return false;
    
    console.log(`🔄 Forcing ${this.serviceName} leadership election...`);
    
    if (this.isLeader) {
      await this.resignLeadership();
      // Wait a moment before attempting to re-acquire
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return await this.attemptLeadership();
  }

  /**
   * Stop the leader election process
   */
  async stop() {
    this.isShuttingDown = true;
    
    if (this.isLeader) {
      await this.resignLeadership();
    }
    
    if (this.leadershipInterval) {
      clearInterval(this.leadershipInterval);
      this.leadershipInterval = null;
    }
    
    if (this.electionInterval) {
      clearInterval(this.electionInterval);
      this.electionInterval = null;
    }
    
    await this.distributedLock.disconnect();
    
    console.log(`🔴 ${this.serviceName} leader election stopped`);
  }
}

module.exports = LeaderElection;
