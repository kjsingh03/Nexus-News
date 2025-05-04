module news_storage::news {
    use std::signer;
    use std::string::String;
    use std::vector;

    // Struct to represent a News item
    struct News has copy, store, drop {
        title: String,
        description: String,
        file_cids: vector<String>, // List of IPFS CIDs for files
        thumbnail_cid: String,     // IPFS CID for thumbnail
    }

    // Global resource to store all news items
    struct NewsCollection has key {
        news_items: vector<News>,
    }

    // Initialize the NewsCollection (called once by the backend)
    public entry fun initialize(account: &signer) {
        let collection = NewsCollection {
            news_items: vector::empty<News>(),
        };
        move_to(account, collection);
    }

    // Add a new news item (only callable by the module owner)
    public entry fun create_news(
        account: &signer,
        title: String,
        description: String,
        file_cids: vector<String>,
        thumbnail_cid: String
    ) acquires NewsCollection {
        let collection = borrow_global_mut<NewsCollection>(signer::address_of(account));
        let news = News {
            title,
            description,
            file_cids,
            thumbnail_cid,
        };
        vector::push_back(&mut collection.news_items, news);
    }

    // View function to get all news items
    public fun get_news(account_addr: address): vector<News> acquires NewsCollection {
        let collection = borrow_global<NewsCollection>(account_addr);
        collection.news_items
    }
}