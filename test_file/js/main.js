// ===== 视频数据 =====
const videoData = {
    hot: [
        {
            id: 1,
            title: "流浪地球3",
            category: "movie",
            views: "2.3亿",
            rating: 9.5,
            duration: "2:45:00",
            badge: "hot",
            badgeText: "热播",
            color: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
            description: "太阳即将毁灭，人类在地球表面建造出巨大的推进器，寻找新的家园。然而宇宙之路危机四伏，为了拯救地球，流浪地球时代的年轻人再次挺身而出，展开争分夺秒的生死之战。",
            tags: ["科幻", "冒险", "灾难", "刘慈欣"],
            date: "2024",
            likes: "156万"
        },
        {
            id: 2,
            title: "三体",
            category: "tv",
            views: "1.8亿",
            rating: 9.3,
            duration: "45:32",
            badge: "vip",
            badgeText: "VIP",
            color: "linear-gradient(135deg, #2d1b69 0%, #11998e 100%)",
            description: "文化大革命如火如荼进行的同时，军方探寻外星文明的绝秘计划"红岸工程"取得了突破性进展。但在按下发射键的那一刻，历经劫难的叶文洁没有意识到，她彻底改变了人类的命运。",
            tags: ["科幻", "悬疑", "刘慈欣", "改编"],
            date: "2024",
            likes: "128万"
        },
        {
            id: 3,
            title: "庆余年2",
            category: "tv",
            views: "3.1亿",
            rating: 9.1,
            duration: "42:15",
            badge: "hot",
            badgeText: "热播",
            color: "linear-gradient(135deg, #c31432 0%, #240b36 100%)",
            description: "范闲历经家族、江湖、庙堂的种种考验与锤炼，书写出一段不同寻常又酣畅淋漓的人生传奇。故事承接前作，继续讲述范闲在朝堂与江湖中的冒险。",
            tags: ["古装", "权谋", "喜剧", "改编"],
            date: "2024",
            likes: "189万"
        },
        {
            id: 4,
            title: "封神第一部",
            category: "movie",
            views: "1.5亿",
            rating: 8.9,
            duration: "2:28:00",
            badge: "new",
            badgeText: "新上线",
            color: "linear-gradient(135deg, #834d9b 0%, #d04ed6 100%)",
            description: "商王殷寿与狐妖苏妲己勾结，暴虐无道，引发天谴。昆仑仙人姜子牙携"封神榜"下山，寻找天下共主，以救苍生。西伯侯之子姬发逐渐发现殷寿的本来面目，反出朝歌。",
            tags: ["奇幻", "古装", "神话", "史诗"],
            date: "2024",
            likes: "98万"
        },
        {
            id: 5,
            title: "长安三万里",
            category: "anime",
            views: "9800万",
            rating: 9.0,
            duration: "2:05:00",
            badge: "hot",
            badgeText: "热播",
            color: "linear-gradient(135deg, #f12711 0%, #f5af19 100%)",
            description: "安史之乱后数年，吐蕃大军入侵西南，大唐节度使高适交战不利。长安岌岌可危，困守孤城的高适向监军太监回忆起自己与李白的一生往事。",
            tags: ["动画", "历史", "诗歌", "大唐"],
            date: "2024",
            likes: "76万"
        },
        {
            id: 6,
            title: "孤注一掷",
            category: "movie",
            views: "2.1亿",
            rating: 8.7,
            duration: "2:10:00",
            badge: "vip",
            badgeText: "VIP",
            color: "linear-gradient(135deg, #000428 0%, #004e92 100%)",
            description: "程序员潘生和模特安娜被海外高薪招聘广告吸引，双双跳入境外网络诈骗工厂的深渊。面对诈骗工厂的残酷现实，他们能否逃出生天？",
            tags: ["犯罪", "悬疑", "现实题材"],
            date: "2024",
            likes: "112万"
        }
    ],
    trending: [
        {
            id: 7,
            title: "繁花",
            category: "tv",
            views: "2.5亿",
            rating: 9.2,
            duration: "48:20",
            badge: "hot",
            badgeText: "热播",
            color: "linear-gradient(135deg, #ee0979 0%, #ff6a00 100%)",
            description: "上世纪九十年代，阿宝在时代浪潮中成为商界弄潮儿。在繁华与落寞之间，他经历了友情、爱情与事业的种种考验。",
            tags: ["年代", "商战", "王家卫", "上海"],
            date: "2024",
            likes: "145万"
        },
        {
            id: 8,
            title: "热辣滚烫",
            category: "movie",
            views: "1.9亿",
            rating: 8.5,
            duration: "2:05:00",
            badge: "new",
            badgeText: "新上线",
            color: "linear-gradient(135deg, #ff416c 0%, #ff4b2b 100%)",
            description: "宅家多年的乐莹生活一团糟，在经历了一系列打击后，她决定改变自己的人生。通过拳击训练，她找到了重新出发的勇气。",
            tags: ["喜剧", "励志", "运动", "贾玲"],
            date: "2024",
            likes: "132万"
        },
        {
            id: 9,
            title: "第二十条",
            category: "movie",
            views: "1.6亿",
            rating: 8.8,
            duration: "2:15:00",
            badge: "vip",
            badgeText: "VIP",
            color: "linear-gradient(135deg, #4568dc 0%, #b06ab3 100%)",
            description: "检察官韩明人到中年，想在事业上最后拼一次，却卷入了一起分歧巨大的案件。在法与情的碰撞中，他坚守着心中的正义。",
            tags: ["剧情", "法律", "张艺谋", "现实"],
            date: "2024",
            likes: "95万"
        },
        {
            id: 10,
            title: "与凤行",
            category: "tv",
            views: "2.8亿",
            rating: 8.6,
            duration: "45:00",
            badge: "hot",
            badgeText: "热播",
            color: "linear-gradient(135deg, #00b09b 0%, #96c93d 100%)",
            description: "灵界碧苍王沈璃为掌握自己的命运，在逃婚过程中意外遇到了在人间游历的神行止，两人共同经历了一系列冒险，逐渐产生了深厚的感情。",
            tags: ["古装", "仙侠", "爱情", "赵丽颖"],
            date: "2024",
            likes: "167万"
        },
        {
            id: 11,
            title: "飞驰人生2",
            category: "movie",
            views: "1.4亿",
            rating: 8.4,
            duration: "2:00:00",
            badge: "new",
            badgeText: "新上线",
            color: "linear-gradient(135deg, #f7971e 0%, #ffd200 100%)",
            description: "昔日冠军车手张驰沦为驾校教练，生活落魄。一次偶然的机会让他重新燃起赛车梦想，带领年轻车手重返巴音布鲁克拉力赛。",
            tags: ["喜剧", "赛车", "励志", "韩寒"],
            date: "2024",
            likes: "88万"
        },
        {
            id: 12,
            title: "追风者",
            category: "tv",
            views: "1.2亿",
            rating: 8.9,
            duration: "42:30",
            badge: "vip",
            badgeText: "VIP",
            color: "linear-gradient(135deg, #642b73 0%, #c6426e 100%)",
            description: "1930年代的上海，魏若来从一名普通的银行职员，在时代洪流中逐渐成长为金融领域的佼佼者，见证了中国金融业的变迁。",
            tags: ["年代", "金融", "谍战", "王一博"],
            date: "2024",
            likes: "78万"
        }
    ],
    exclusive: [
        {
            id: 13,
            title: "斗破苍穹 年番",
            category: "anime",
            views: "8500万",
            rating: 8.8,
            duration: "24:00",
            badge: "exclusive",
            badgeText: "独播",
            color: "linear-gradient(135deg, #f857a6 0%, #ff5858 100%)",
            description: "萧炎在药老的指导下，踏上了修炼之路。在斗气大陆上，他经历了无数挑战与冒险，逐渐成长为一名强大的斗者。",
            tags: ["动画", "玄幻", "热血", "改编"],
            date: "2024",
            likes: "65万"
        },
        {
            id: 14,
            title: "完美世界",
            category: "anime",
            views: "7200万",
            rating: 8.6,
            duration: "22:00",
            badge: "exclusive",
            badgeText: "独播",
            color: "linear-gradient(135deg, #00c6ff 0%, #0072ff 100%)",
            description: "一粒尘可填海，一根草斩尽日月星辰。少年石昊从大荒中走出，踏上了一条充满挑战的修炼之路。",
            tags: ["动画", "玄幻", "热血", "辰东"],
            date: "2024",
            likes: "58万"
        },
        {
            id: 15,
            title: "吞噬星空",
            category: "anime",
            views: "6800万",
            rating: 8.5,
            duration: "23:00",
            badge: "exclusive",
            badgeText: "独播",
            color: "linear-gradient(135deg, #8e2de2 0%, #4a00e0 100%)",
            description: "地球经历RR病毒后，变异兽横行。罗峰在一次意外中获得了特殊能力，从此踏上了武者之路，守护人类文明。",
            tags: ["动画", "科幻", "热血", "我吃西红柿"],
            date: "2024",
            likes: "52万"
        },
        {
            id: 16,
            title: "仙逆",
            category: "anime",
            views: "5500万",
            rating: 8.7,
            duration: "21:00",
            badge: "exclusive",
            badgeText: "独播",
            color: "linear-gradient(135deg, #00d2ff 0%, #3a7bd5 100%)",
            description: "王林本是一个平庸的少年，因机缘巧合踏入修仙之路。在残酷的修仙界中，他以坚定的意志和不屈的精神，一步步走向巅峰。",
            tags: ["动画", "仙侠", "热血", "耳根"],
            date: "2024",
            likes: "48万"
        }
    ],
    anime: [
        {
            id: 17,
            title: "一念永恒",
            category: "anime",
            views: "6200万",
            rating: 8.9,
            duration: "24:00",
            badge: "hot",
            badgeText: "热播",
            color: "linear-gradient(135deg, #fc5c7d 0%, #6a82fb 100%)",
            description: "白小纯生性怕死，为了长生不老踏上修仙之路。在灵溪宗中，他以独特的方式修炼，引发了一系列啼笑皆非的故事。",
            tags: ["动画", "仙侠", "搞笑", "耳根"],
            date: "2024",
            likes: "55万"
        },
        {
            id: 18,
            title: "师兄啊师兄",
            category: "anime",
            views: "4800万",
            rating: 8.4,
            duration: "20:00",
            badge: "new",
            badgeText: "新上线",
            color: "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)",
            description: "李长寿穿越到洪荒世界，成为一个普通的修仙者。他深知洪荒的危险，决定苟住修炼，却意外卷入了一系列事件中。",
            tags: ["动画", "仙侠", "搞笑", "穿越"],
            date: "2024",
            likes: "42万"
        },
        {
            id: 19,
            title: "画江湖之不良人6",
            category: "anime",
            views: "5100万",
            rating: 9.1,
            duration: "25:00",
            badge: "hot",
            badgeText: "热播",
            color: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
            description: "唐朝末年，天下大乱。不良帅袁天罡暗中布局，李星云等人在乱世中挣扎求生，揭开了一段段尘封的历史秘密。",
            tags: ["动画", "武侠", "历史", "热血"],
            date: "2024",
            likes: "62万"
        },
        {
            id: 20,
            title: "神印王座",
            category: "anime",
            views: "4500万",
            rating: 8.3,
            duration: "22:00",
            badge: "vip",
            badgeText: "VIP",
            color: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
            description: "魔族入侵，人类骑士龙皓晨为救母亲加入骑士圣殿。在成长的过程中，他逐渐发现了自己身世的秘密，肩负起拯救人类的使命。",
            tags: ["动画", "奇幻", "热血", "唐家三少"],
            date: "2024",
            likes: "38万"
        }
    ]
};

// 评论数据
const commentsData = [
    { user: "影视达人", text: "这部剧真的太精彩了！剧情紧凑，演员演技在线，强烈推荐！", time: "2小时前", likes: 156 },
    { user: "追剧小能手", text: "等了这么久终于更新了，每一集都看不够，期待后续发展！", time: "5小时前", likes: 89 },
    { user: "电影爱好者", text: "特效做得太棒了，画面质感一流，国产剧越来越好了！", time: "1天前", likes: 234 },
    { user: "剧评人小王", text: "剧情逻辑严密，人物塑造丰满，是一部难得的佳作。", time: "2天前", likes: 178 },
    { user: "吃瓜群众", text: "演员阵容强大，导演功力深厚，值得一看！", time: "3天前", likes: 92 }
];

// ===== DOM 元素 =====
const videoModal = document.getElementById('videoModal');
const modalClose = document.querySelector('.modal-close');
const modalOverlay = document.querySelector('.modal-overlay');
const hotVideosGrid = document.getElementById('hotVideos');
const trendingVideosGrid = document.getElementById('trendingVideos');
const exclusiveVideosGrid = document.getElementById('exclusiveVideos');
const animeVideosGrid = document.getElementById('animeVideos');

// ===== 初始化 =====
document.addEventListener('DOMContentLoaded', () => {
    renderVideoGrid(hotVideosGrid, videoData.hot);
    renderVideoGrid(trendingVideosGrid, videoData.trending);
    renderVideoGrid(exclusiveVideosGrid, videoData.exclusive);
    renderVideoGrid(animeVideosGrid, videoData.anime);
    initBanner();
    initNavigation();
    initSearch();
    initScrollEffect();
});

// ===== 渲染视频网格 =====
function renderVideoGrid(container, videos) {
    container.innerHTML = videos.map(video => `
        <div class="video-card" data-id="${video.id}">
            <div class="video-thumbnail" style="background: ${video.color}">
                <div class="thumbnail-placeholder">
                    <i class="fas fa-film"></i>
                </div>
                <div class="play-overlay">
                    <i class="fas fa-play"></i>
                </div>
                <span class="video-duration">${video.duration}</span>
                <span class="video-badge badge-${video.badge}">${video.badgeText}</span>
            </div>
            <div class="video-info-card">
                <h3 class="video-title-card">${video.title}</h3>
                <div class="video-meta-card">
                    <span class="video-views">
                        <i class="fas fa-play-circle"></i>
                        ${video.views}
                    </span>
                    <span class="video-rating">
                        <i class="fas fa-star"></i>
                        ${video.rating}
                    </span>
                </div>
            </div>
        </div>
    `).join('');

    // 添加点击事件
    container.querySelectorAll('.video-card').forEach(card => {
        card.addEventListener('click', () => {
            const videoId = parseInt(card.dataset.id);
            openVideoModal(videoId);
        });
    });
}

// ===== 打开视频模态框 =====
function openVideoModal(videoId) {
    const allVideos = [...videoData.hot, ...videoData.trending, ...videoData.exclusive, ...videoData.anime];
    const video = allVideos.find(v => v.id === videoId);
    
    if (!video) return;

    // 更新模态框内容
    document.getElementById('modalVideoTitle').textContent = video.title;
    document.getElementById('modalViews').textContent = video.views;
    document.getElementById('modalLikes').textContent = video.likes;
    document.getElementById('modalDate').textContent = video.date;
    document.getElementById('modalDescription').textContent = video.description;
    
    // 更新标签
    const tagsContainer = document.getElementById('modalTags');
    tagsContainer.innerHTML = video.tags.map(tag => `<span class="tag">${tag}</span>`).join('');
    
    // 更新播放器背景
    const playerPlaceholder = document.querySelector('.player-placeholder');
    playerPlaceholder.style.background = video.color;
    
    // 渲染评论
    renderComments();
    
    // 显示模态框
    videoModal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

// ===== 关闭视频模态框 =====
function closeVideoModal() {
    videoModal.classList.remove('active');
    document.body.style.overflow = '';
}

modalClose.addEventListener('click', closeVideoModal);
modalOverlay.addEventListener('click', closeVideoModal);

// ESC键关闭
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && videoModal.classList.contains('active')) {
        closeVideoModal();
    }
});

// ===== 渲染评论 =====
function renderComments() {
    const commentsList = document.getElementById('commentsList');
    commentsList.innerHTML = commentsData.map(comment => `
        <div class="comment-item">
            <div class="comment-avatar">
                <i class="fas fa-user"></i>
            </div>
            <div class="comment-content">
                <div class="comment-user">${comment.user}</div>
                <div class="comment-text">${comment.text}</div>
                <div class="comment-actions">
                    <span><i class="fas fa-thumbs-up"></i> ${comment.likes}</span>
                    <span><i class="fas fa-reply"></i> 回复</span>
                    <span>${comment.time}</span>
                </div>
            </div>
        </div>
    `).join('');
}

// ===== 轮播图功能 =====
function initBanner() {
    const slides = document.querySelectorAll('.banner-slide');
    const dots = document.querySelectorAll('.dot');
    const prevBtn = document.querySelector('.banner-arrow.prev');
    const nextBtn = document.querySelector('.banner-arrow.next');
    let currentSlide = 0;
    let autoPlayInterval;

    function goToSlide(index) {
        slides[currentSlide].classList.remove('active');
        dots[currentSlide].classList.remove('active');
        
        currentSlide = (index + slides.length) % slides.length;
        
        slides[currentSlide].classList.add('active');
        dots[currentSlide].classList.add('active');
    }

    function nextSlide() {
        goToSlide(currentSlide + 1);
    }

    function prevSlide() {
        goToSlide(currentSlide - 1);
    }

    function startAutoPlay() {
        autoPlayInterval = setInterval(nextSlide, 5000);
    }

    function stopAutoPlay() {
        clearInterval(autoPlayInterval);
    }

    // 事件监听
    prevBtn.addEventListener('click', () => {
        prevSlide();
        stopAutoPlay();
        startAutoPlay();
    });

    nextBtn.addEventListener('click', () => {
        nextSlide();
        stopAutoPlay();
        startAutoPlay();
    });

    dots.forEach((dot, index) => {
        dot.addEventListener('click', () => {
            goToSlide(index);
            stopAutoPlay();
            startAutoPlay();
        });
    });

    // 鼠标悬停暂停
    const bannerSection = document.querySelector('.banner-section');
    bannerSection.addEventListener('mouseenter', stopAutoPlay);
    bannerSection.addEventListener('mouseleave', startAutoPlay);

    // 开始自动播放
    startAutoPlay();
}

// ===== 导航功能 =====
function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            
            // 更新激活状态
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
            // 获取分类
            const category = item.dataset.category;
            
            // 滚动到对应区域
            if (category === 'all') {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
                const sectionMap = {
                    'movie': hotVideosGrid,
                    'tv': trendingVideosGrid,
                    'anime': animeVideosGrid,
                    'variety': exclusiveVideosGrid,
                    'documentary': hotVideosGrid
                };
                
                const targetSection = sectionMap[category];
                if (targetSection) {
                    targetSection.closest('.video-section').scrollIntoView({ 
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            }
        });
    });

    // Tab切换功能
    document.querySelectorAll('.section-tabs').forEach(tabGroup => {
        const tabs = tabGroup.querySelectorAll('.tab-btn');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
            });
        });
    });
}

// ===== 搜索功能 =====
function initSearch() {
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');

    function performSearch() {
        const query = searchInput.value.trim().toLowerCase();
        if (!query) return;

        const allVideos = [...videoData.hot, ...videoData.trending, ...videoData.exclusive, ...videoData.anime];
        const results = allVideos.filter(video => 
            video.title.toLowerCase().includes(query) ||
            video.tags.some(tag => tag.toLowerCase().includes(query)) ||
            video.description.toLowerCase().includes(query)
        );

        if (results.length > 0) {
            // 显示搜索结果
            alert(`找到 ${results.length} 个结果：\n${results.map(v => v.title).join('\n')}`);
        } else {
            alert('未找到相关视频');
        }
    }

    searchBtn.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            performSearch();
        }
    });
}

// ===== 滚动效果 =====
function initScrollEffect() {
    const header = document.querySelector('.header');
    
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });
}

// ===== 播放器控制 =====
document.addEventListener('click', (e) => {
    // 播放按钮
    if (e.target.closest('.btn-play') || e.target.closest('.play-icon')) {
        const playBtn = e.target.closest('.btn-play') || e.target.closest('.play-icon');
        const videoId = playBtn.dataset.video;
        if (videoId) {
            openVideoModal(parseInt(videoId));
        }
    }

    // 播放/暂停
    if (e.target.closest('.play-pause')) {
        const btn = e.target.closest('.play-pause');
        const icon = btn.querySelector('i');
        if (icon.classList.contains('fa-play')) {
            icon.classList.remove('fa-play');
            icon.classList.add('fa-pause');
        } else {
            icon.classList.remove('fa-pause');
            icon.classList.add('fa-play');
        }
    }

    // 全屏
    if (e.target.closest('.fullscreen')) {
        const player = document.querySelector('.player-container');
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            player.requestFullscreen();
        }
    }
});

// ===== 评论提交 =====
document.addEventListener('click', (e) => {
    if (e.target.closest('.comment-input button')) {
        const input = document.querySelector('.comment-input input');
        const text = input.value.trim();
        
        if (text) {
            const newComment = {
                user: "我",
                text: text,
                time: "刚刚",
                likes: 0
            };
            
            commentsData.unshift(newComment);
            renderComments();
            input.value = '';
        }
    }
});

// ===== 音量控制 =====
document.addEventListener('input', (e) => {
    if (e.target.classList.contains('volume-slider')) {
        const volume = e.target.value;
        const icon = e.target.closest('.volume-control').querySelector('i');
        
        if (volume == 0) {
            icon.className = 'fas fa-volume-mute';
        } else if (volume < 50) {
            icon.className = 'fas fa-volume-down';
        } else {
            icon.className = 'fas fa-volume-up';
        }
    }
});

// ===== 进度条点击 =====
document.addEventListener('click', (e) => {
    if (e.target.closest('.progress-bar')) {
        const bar = e.target.closest('.progress-bar');
        const rect = bar.getBoundingClientRect();
        const percent = ((e.clientX - rect.left) / rect.width) * 100;
        bar.querySelector('.progress-fill').style.width = percent + '%';
    }
});

console.log('MiniVideo 网站已加载完成！');
