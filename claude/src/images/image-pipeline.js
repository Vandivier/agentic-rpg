export class ImagePipeline {
  constructor(options = {}) {
    this.options = {
      previewTimeout: options.previewTimeout || 5000,
      hqTimeout: options.hqTimeout || 20000,
      retryAttempts: options.retryAttempts || 2,
      ...options
    };

    this.activeJobs = new Map();
    this.completedJobs = new Map();
    this.jobQueue = [];
  }

  async requestImage({ sceneId, prompt, mode = 'preview', seed, size = '512x512' }) {
    const jobId = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const job = {
      jobId,
      sceneId,
      prompt,
      mode,
      seed,
      size,
      status: 'queued',
      createdAt: new Date().toISOString(),
      attempts: 0
    };

    this.activeJobs.set(jobId, job);

    if (mode === 'preview') {
      this.processPreviewImage(job);
    } else if (mode === 'hq') {
      this.processHQImage(job);
    }

    return {
      jobId,
      etaSec: mode === 'preview' ? 3 : 12,
      status: 'queued'
    };
  }

  async processPreviewImage(job) {
    try {
      job.status = 'generating';
      job.startedAt = new Date().toISOString();

      const result = await this.generateImage({
        prompt: job.prompt,
        seed: job.seed,
        size: job.size,
        steps: 20,
        quality: 'fast'
      });

      job.status = 'ready';
      job.completedAt = new Date().toISOString();
      job.result = result;

      this.completedJobs.set(job.jobId, job);
      this.activeJobs.delete(job.jobId);

      return job;

    } catch (error) {
      console.error('Preview image generation error:', error);
      return this.handleImageError(job, error);
    }
  }

  async processHQImage(job) {
    try {
      job.status = 'generating';
      job.startedAt = new Date().toISOString();

      const result = await this.generateImage({
        prompt: job.prompt,
        seed: job.seed,
        size: job.size || '1024x1024',
        steps: 50,
        quality: 'high'
      });

      job.status = 'ready';
      job.completedAt = new Date().toISOString();
      job.result = result;

      this.completedJobs.set(job.jobId, job);
      this.activeJobs.delete(job.jobId);

      return job;

    } catch (error) {
      console.error('HQ image generation error:', error);
      return this.handleImageError(job, error);
    }
  }

  async generateImage({ prompt, seed, size, steps, quality }) {
    const sanitizedPrompt = this.sanitizePrompt(prompt);

    const mockUrl = this.generateMockImageUrl(sanitizedPrompt, seed, size);

    const delay = quality === 'fast' ?
      1000 + Math.random() * 3000 :
      8000 + Math.random() * 8000;

    await new Promise(resolve => setTimeout(resolve, delay));

    return {
      url: mockUrl,
      width: parseInt(size.split('x')[0]),
      height: parseInt(size.split('x')[1]),
      seed,
      steps,
      prompt: sanitizedPrompt,
      quality
    };
  }

  generateMockImageUrl(prompt, seed, size) {
    const baseUrl = 'https://picsum.photos';
    const [width, height] = size.split('x');

    const seedParam = seed ? `?random=${seed}` : '';

    return `${baseUrl}/${width}/${height}${seedParam}`;
  }

  sanitizePrompt(prompt) {
    let sanitized = prompt
      .replace(/\[.*?\]/g, '')
      .replace(/\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const inappropriateTerms = ['nude', 'naked', 'sexual', 'explicit', 'gore', 'violence'];
    inappropriateTerms.forEach(term => {
      const regex = new RegExp(`\\b${term}\\b`, 'gi');
      sanitized = sanitized.replace(regex, '');
    });

    if (sanitized.length > 200) {
      sanitized = sanitized.substring(0, 200) + '...';
    }

    return sanitized || 'fantasy adventure scene';
  }

  async rerenderHQ(jobId) {
    const previewJob = this.completedJobs.get(jobId);
    if (!previewJob) {
      throw new Error(`Job ${jobId} not found`);
    }

    const hqJobId = `${jobId}_hq`;

    const hqJob = {
      jobId: hqJobId,
      sceneId: previewJob.sceneId,
      prompt: previewJob.prompt,
      mode: 'hq',
      seed: previewJob.seed,
      size: '1024x1024',
      status: 'queued',
      createdAt: new Date().toISOString(),
      attempts: 0,
      parentJobId: jobId
    };

    this.activeJobs.set(hqJobId, hqJob);
    this.processHQImage(hqJob);

    return {
      jobId: hqJobId,
      etaSec: 12,
      status: 'queued'
    };
  }

  getJobStatus(jobId) {
    const activeJob = this.activeJobs.get(jobId);
    if (activeJob) {
      return {
        jobId,
        status: activeJob.status,
        progress: this.calculateProgress(activeJob),
        eta: this.calculateETA(activeJob)
      };
    }

    const completedJob = this.completedJobs.get(jobId);
    if (completedJob) {
      return {
        jobId,
        status: completedJob.status,
        url: completedJob.result?.url,
        result: completedJob.result
      };
    }

    return {
      jobId,
      status: 'not_found'
    };
  }

  calculateProgress(job) {
    if (job.status === 'queued') return 0;
    if (job.status === 'ready' || job.status === 'failed') return 100;

    const elapsed = Date.now() - new Date(job.startedAt).getTime();
    const expectedDuration = job.mode === 'preview' ? 4000 : 15000;

    return Math.min(90, Math.floor((elapsed / expectedDuration) * 100));
  }

  calculateETA(job) {
    if (job.status === 'queued') {
      return job.mode === 'preview' ? 3 : 12;
    }

    if (job.status === 'ready' || job.status === 'failed') return 0;

    const elapsed = Date.now() - new Date(job.startedAt).getTime();
    const expectedDuration = job.mode === 'preview' ? 4000 : 15000;

    return Math.max(0, Math.ceil((expectedDuration - elapsed) / 1000));
  }

  handleImageError(job, error) {
    job.attempts++;

    if (job.attempts < this.options.retryAttempts) {
      console.log(`Retrying image generation for job ${job.jobId}, attempt ${job.attempts + 1}`);

      setTimeout(() => {
        if (job.mode === 'preview') {
          this.processPreviewImage(job);
        } else {
          this.processHQImage(job);
        }
      }, 1000 * job.attempts);

      return job;
    }

    job.status = 'failed';
    job.error = error.message;
    job.completedAt = new Date().toISOString();

    this.completedJobs.set(job.jobId, job);
    this.activeJobs.delete(job.jobId);

    return job;
  }

  getFallbackImage(sceneId) {
    const fallbackImages = {
      'tavern': 'https://via.placeholder.com/512x512/8B4513/FFE4B5?text=Tavern',
      'dungeon': 'https://via.placeholder.com/512x512/2F2F2F/8A8A8A?text=Dungeon',
      'forest': 'https://via.placeholder.com/512x512/228B22/90EE90?text=Forest',
      'castle': 'https://via.placeholder.com/512x512/708090/F5F5DC?text=Castle',
      'default': 'https://via.placeholder.com/512x512/4682B4/F0F8FF?text=Adventure'
    };

    for (const [keyword, url] of Object.entries(fallbackImages)) {
      if (sceneId.includes(keyword)) {
        return url;
      }
    }

    return fallbackImages.default;
  }

  cleanupOldJobs() {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000;

    for (const [jobId, job] of this.completedJobs.entries()) {
      const jobAge = now - new Date(job.createdAt).getTime();
      if (jobAge > maxAge) {
        this.completedJobs.delete(jobId);
      }
    }

    for (const [jobId, job] of this.activeJobs.entries()) {
      const jobAge = now - new Date(job.createdAt).getTime();
      if (jobAge > this.options.previewTimeout * 2) {
        this.handleImageError(job, new Error('Job timeout'));
      }
    }
  }

  getMetrics() {
    const activeCount = this.activeJobs.size;
    const completedCount = this.completedJobs.size;

    const statusCounts = { queued: 0, generating: 0, ready: 0, failed: 0 };

    this.activeJobs.forEach(job => {
      statusCounts[job.status] = (statusCounts[job.status] || 0) + 1;
    });

    this.completedJobs.forEach(job => {
      statusCounts[job.status] = (statusCounts[job.status] || 0) + 1;
    });

    return {
      activeJobs: activeCount,
      completedJobs: completedCount,
      statusDistribution: statusCounts,
      queueLength: this.jobQueue.length
    };
  }
}